/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Safe Redirect Chain Inspector Module
 * Follows HTTP 3xx redirects manually with strict per-hop SSRF guards,
 * loop detection, hop caps, and HTTPS->HTTP downgrade detection.
 */

import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import * as S from "@effect/schema/Schema";
import { classifyIpAddress } from "./ip-utils";
import { validateUrl } from "./url-validator";

export class RedirectCheckResult extends S.Class<RedirectCheckResult>(
	"RedirectCheckResult",
)({
	isValid: S.Boolean,
	initialUrl: S.String,
	finalUrl: S.String,
	hopCount: S.Number,
	chain: S.Array(S.String),
	downgradedToHttp: S.Boolean,
	errors: S.Array(S.String),
	warnings: S.Array(S.String),
	checkTime: S.Number,
}) {}

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
const DEFAULT_MAX_HOPS = 5;
const DEFAULT_TIMEOUT_MS = 5000;

/**
 * SSRF-safe DNS lookup for redirect probes.
 * Refuses to connect to private, loopback, link-local, or reserved IPs.
 */
function safeRedirectLookup(
	hostname: string,
	options: dns.LookupOptions,
	callback: (
		err: NodeJS.ErrnoException | null,
		address: string | dns.LookupAddress[],
		family?: number,
	) => void,
): void {
	dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
		if (err) {
			callback(err, "");
			return;
		}
		if (!addresses || addresses.length === 0) {
			callback(new Error("DNS lookup returned no addresses"), "");
			return;
		}

		for (const entry of addresses) {
			const classification = classifyIpAddress(entry.address);
			if (classification.isRestricted) {
				callback(
					new Error(
						`Redirect target resolves to ${classification.reason} IP address: ${entry.address}`,
					),
					"",
				);
				return;
			}
		}

		if (options.all) {
			callback(null, addresses);
		} else {
			const first = addresses[0]!;
			callback(null, first.address, first.family);
		}
	});
}

function probeSingleHop(
	targetUrl: string,
	timeoutMs: number,
): Promise<{ statusCode: number; location: string | null }> {
	return new Promise((resolve, reject) => {
		const parsed = new URL(targetUrl);
		const isHttps = parsed.protocol === "https:";
		const client = isHttps ? https : http;

		const req = client.request(
			{
				hostname: parsed.hostname,
				port: parsed.port ? Number(parsed.port) : isHttps ? 443 : 80,
				path: `${parsed.pathname}${parsed.search}`,
				method: "HEAD",
				timeout: timeoutMs,
				rejectUnauthorized: true,
				lookup: safeRedirectLookup as http.RequestOptions["lookup"],
				headers: {
					"User-Agent": "LinksSecurityVerifier/2.0 (+https://links.mikeodnis.dev)",
					Accept: "*/*",
				},
			},
			(res) => {
				const statusCode = res.statusCode ?? 0;
				const rawLocation = res.headers.location;
				const location = Array.isArray(rawLocation)
					? (rawLocation[0] ?? null)
					: (rawLocation ?? null);

				res.resume();
				req.destroy();
				resolve({ statusCode, location });
			},
		);

		req.on("error", (err) => {
			reject(err);
		});

		req.on("timeout", () => {
			req.destroy();
			reject(new Error("Redirect probe timed out"));
		});

		req.end();
	});
}

/**
 * Inspect redirect chain with strict SSRF, hop limit, loop, and downgrade enforcement.
 */
export async function checkRedirects(
	url: string,
	options: { maxHops?: number; timeout?: number } = {},
): Promise<RedirectCheckResult> {
	const startTime = Date.now();
	const maxHops = options.maxHops ?? DEFAULT_MAX_HOPS;
	const totalTimeout = options.timeout ?? DEFAULT_TIMEOUT_MS;

	const errors: string[] = [];
	const warnings: string[] = [];
	const chain: string[] = [url];
	const visited = new Set<string>([url]);

	let currentUrl = url;
	let hopCount = 0;
	let downgradedToHttp = false;

	const initialValidation = await validateUrl(url);
	if (!initialValidation.isValid) {
		return new RedirectCheckResult({
			isValid: false,
			initialUrl: url,
			finalUrl: url,
			hopCount: 0,
			chain,
			downgradedToHttp: false,
			errors: ["Initial URL failed validation before redirect inspection"],
			warnings,
			checkTime: Date.now() - startTime,
		});
	}

	const initialHost = new URL(url).hostname.toLowerCase();

	while (hopCount <= maxHops) {
		const elapsed = Date.now() - startTime;
		const remaining = totalTimeout - elapsed;
		if (remaining <= 200) {
			warnings.push("Redirect inspection timed out before completing all hops");
			break;
		}

		let hopResponse: { statusCode: number; location: string | null };
		try {
			hopResponse = await probeSingleHop(currentUrl, Math.min(remaining, 3500));
		} catch (err: any) {
			const message = err?.message || "Redirect probe failed";
			if (/resolves to .* IP address/i.test(message)) {
				errors.push(message);
			} else {
				// Some origins reject HEAD or drop non-browser probes; record as warning
				// unless a redirect itself targeted a restricted address.
				warnings.push(`Redirect probe could not inspect hop: ${message}`);
			}
			break;
		}

		if (
			!REDIRECT_STATUS_CODES.has(hopResponse.statusCode) ||
			!hopResponse.location
		) {
			break;
		}

		let nextUrl: string;
		try {
			nextUrl = new URL(hopResponse.location, currentUrl).toString();
		} catch {
			errors.push("Redirect returned a malformed Location header");
			break;
		}

		hopCount += 1;
		if (hopCount > maxHops) {
			errors.push(`Redirect chain exceeds maximum allowed hops (${maxHops})`);
			break;
		}

		// Detect redirect loops
		if (visited.has(nextUrl)) {
			errors.push("Redirect loop detected");
			break;
		}
		visited.add(nextUrl);
		chain.push(nextUrl);

		// Validate every intermediate & final redirect target for SSRF / protocol / port safety
		const hopValidation = await validateUrl(nextUrl);
		if (!hopValidation.isValid) {
			errors.push(
				`Unsafe redirect target blocked (${hopValidation.errors[0] || "invalid URL"})`,
			);
			currentUrl = nextUrl;
			break;
		}

		// Block HTTPS -> HTTP downgrade in redirect chain
		const prevProtocol = new URL(currentUrl).protocol;
		const nextProtocol = new URL(nextUrl).protocol;
		if (prevProtocol === "https:" && nextProtocol === "http:") {
			downgradedToHttp = true;
			errors.push("Redirect chain downgrades from HTTPS to insecure HTTP");
			currentUrl = nextUrl;
			break;
		}

		currentUrl = nextUrl;
	}

	// Flag cross-domain redirects as informational warning
	try {
		const finalHost = new URL(currentUrl).hostname.toLowerCase();
		if (hopCount > 0 && finalHost !== initialHost) {
			warnings.push(`URL redirects across domains (${initialHost} -> ${finalHost})`);
		}
		if (hopCount >= 3 && errors.length === 0) {
			warnings.push(`Long redirect chain (${hopCount} hops)`);
		}
	} catch {
		// Ignore parse errors on already-flagged invalid final URL
	}

	return new RedirectCheckResult({
		isValid: errors.length === 0,
		initialUrl: url,
		finalUrl: currentUrl,
		hopCount,
		chain,
		downgradedToHttp,
		errors,
		warnings,
		checkTime: Date.now() - startTime,
	});
}
