/**
 * Copyright 2026 Mike Odnis
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
 * SSRF-safe, redirect-aware link reachability probe.
 * - Resolves DNS and rejects any host with restricted/private IPs.
 * - Pins each TCP/TLS hop to a validated public IP.
 * - Tries HEAD first and falls back to GET on 405/501/403/400.
 * - Enforces a strict 5s total deadline and max 3 redirects per link.
 */

import dns from "node:dns/promises";
import { classifyIpAddress, isBlockedHostname } from "../security/ip-utils";
import {
	type ProbeHeaders,
	type ProbeRequest,
	type PublicAddress,
	requestPinned,
	toPublicAddress,
} from "./transport";
import type { LinkObservation } from "./types";
import { normalizeLinkUrl } from "./url";

const DEADLINE_MS = 5000;
const MAX_REDIRECTS = 3;
const MAX_DNS_ANSWERS = 16;
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const HEAD_FALLBACK_STATUSES = new Set([400, 403, 405, 501]);

export interface ProbeDependencies {
	readonly resolve: (
		hostname: string,
		signal: AbortSignal,
	) => Promise<readonly string[]>;
	readonly request: (target: ProbeRequest) => Promise<ProbeHeaders>;
}

export async function resolveHostAddresses(
	hostname: string,
	signal: AbortSignal,
): Promise<readonly string[]> {
	signal.throwIfAborted();
	const literal = classifyIpAddress(hostname);
	if (literal.isIp) {
		return literal.isRestricted ? [] : [literal.normalized];
	}

	const [v4, v6] = await Promise.allSettled([
		dns.resolve4(hostname),
		dns.resolve6(hostname),
	]);
	signal.throwIfAborted();

	const addresses: string[] = [];
	if (v4.status === "fulfilled") addresses.push(...v4.value);
	if (v6.status === "fulfilled") addresses.push(...v6.value);
	return addresses.slice(0, MAX_DNS_ANSWERS);
}

async function resolvePublicAddress(
	hostname: string,
	deps: ProbeDependencies,
	signal: AbortSignal,
): Promise<PublicAddress | null> {
	if (isBlockedHostname(hostname).blocked) return null;

	const rawAddresses = await deps.resolve(hostname, signal);
	if (rawAddresses.length === 0) return null;

	// If ANY resolved address is private/restricted, reject the entire host (blocks DNS rebinding)
	let selected: PublicAddress | null = null;
	for (const raw of rawAddresses.slice(0, MAX_DNS_ANSWERS)) {
		const pub = toPublicAddress(raw);
		if (!pub) return null;
		if (!selected) selected = pub;
	}
	return selected;
}

function classifyStatus(status: number): LinkObservation {
	if (status >= 200 && status < 400) {
		return { kind: "reachable", httpStatus: status };
	}
	if (status === 401 || status === 403) {
		// Auth-walled / bot-gated pages are live destinations, not missing links
		return { kind: "reachable", httpStatus: status };
	}
	if (status === 404 || status === 410) {
		return { kind: "missing", httpStatus: status };
	}
	if (status === 429 || status >= 500 || status === 0) {
		return { kind: "temporary", httpStatus: status || undefined };
	}
	return { kind: "unknown", httpStatus: status };
}

async function observe(
	initialUrl: URL,
	deps: ProbeDependencies,
	signal: AbortSignal,
): Promise<LinkObservation> {
	let current = initialUrl;

	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		signal.throwIfAborted();

		const hostname = current.hostname.toLowerCase();
		const address = await resolvePublicAddress(hostname, deps, signal);
		if (!address) {
			return { kind: "unknown" };
		}

		let headers = await deps.request({
			url: current,
			address,
			method: "HEAD",
			signal,
		});

		if (HEAD_FALLBACK_STATUSES.has(headers.status)) {
			headers = await deps.request({
				url: current,
				address,
				method: "GET",
				signal,
			});
		}

		if (REDIRECTS.has(headers.status) && headers.location) {
			if (hop === MAX_REDIRECTS) {
				return { kind: "temporary", httpStatus: headers.status };
			}
			let resolvedLocation: string;
			try {
				resolvedLocation = new URL(headers.location, current).href;
			} catch {
				return { kind: "unknown", httpStatus: headers.status };
			}
			const canonicalNext = normalizeLinkUrl(resolvedLocation);
			if (!canonicalNext) {
				return { kind: "unknown", httpStatus: headers.status };
			}
			current = new URL(canonicalNext);
			continue;
		}

		return classifyStatus(headers.status);
	}

	return { kind: "temporary" };
}

export function createLinkProbe(deps: ProbeDependencies) {
	return async function probe(rawUrl: string): Promise<LinkObservation> {
		const canonical = normalizeLinkUrl(rawUrl);
		if (!canonical) return { kind: "unknown" };

		const controller = new AbortController();
		let timer: ReturnType<typeof setTimeout> | undefined;
		const deadline = new Promise<LinkObservation>((resolve) => {
			timer = setTimeout(() => {
				controller.abort();
				resolve({ kind: "temporary" });
			}, DEADLINE_MS);
		});

		try {
			return await Promise.race([
				observe(new URL(canonical), deps, controller.signal),
				deadline,
			]);
		} catch (err: any) {
			const code = err?.code;
			if (code === "ENOTFOUND" || code === "ENODATA") {
				return { kind: "missing" };
			}
			return { kind: "temporary" };
		} finally {
			clearTimeout(timer);
			controller.abort();
		}
	};
}

export const probeLink = createLinkProbe({
	resolve: resolveHostAddresses,
	request: requestPinned,
});
