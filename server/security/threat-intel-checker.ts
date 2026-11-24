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
 * Zero-Key Threat Intelligence & DNSBL Checker Module
 * Inspired by lissy93/web-check (`block-lists.js`, `threats.js`).
 *
 * Provides real-time malware & phishing blocklist verification out of the box
 * without requiring paid API keys:
 *  - Cloudflare Security DNS (1.1.1.2 via DoH JSON on port 443) — malware & phishing filter
 *  - Quad9 Threat Intelligence DNS (9.9.9.9 via DNS Resolver) — 20+ aggregated threat feeds
 *  - Abuse.ch URLhaus API (automatically enabled when URLHAUS_AUTH_KEY is set)
 */

import dns from "node:dns/promises";
import { Schema as S } from "effect";
import NodeCache from "node-cache";
import { classifyIpAddress } from "./ip-utils";

export class ThreatIntelHit extends S.Class<ThreatIntelHit>("ThreatIntelHit")({
	provider: S.String,
	category: S.String,
	reason: S.String,
}) {}

export class ThreatIntelCheckResult extends S.Class<ThreatIntelCheckResult>(
	"ThreatIntelCheckResult",
)({
	isSafe: S.Boolean,
	url: S.String,
	hostname: S.String,
	checkedProviders: S.Array(S.String),
	blockedBy: S.Array(
		S.Struct({
			provider: S.String,
			category: S.String,
			reason: S.String,
		}),
	),
	errors: S.Array(S.String),
	warnings: S.Array(S.String),
	checkTime: S.Number,
}) {}

interface DohAnswer {
	readonly name?: string;
	readonly type?: number;
	readonly TTL?: number;
	readonly data?: string;
}

interface DohJsonResponse {
	readonly Status?: number;
	readonly AD?: boolean;
	readonly Answer?: readonly DohAnswer[];
	readonly Authority?: readonly DohAnswer[];
	readonly Comment?: string | readonly string[];
}

export interface ThreatIntelOptions {
	readonly timeoutMs?: number;
	/**
	 * Whether Phase 1 DNS confirmed that this domain resolves normally.
	 * Used to distinguish Quad9 threat-blocked NXDOMAIN from genuinely
	 * non-existent domains.
	 */
	readonly domainResolvedInDns?: boolean;
	readonly skipCache?: boolean;
}

const DEFAULT_TIMEOUT_MS = 2000;
const threatIntelCache = new NodeCache({ stdTTL: 900 }); // 15 minutes

const CLOUDFLARE_SECURITY_DOH = "https://security.cloudflare-dns.com/dns-query";
const QUAD9_DNS_SERVER = "9.9.9.9";
const URLHAUS_API_URL = "https://urlhaus-api.abuse.ch/v1/url/";

const SINKHOLE_IPS = new Set(["0.0.0.0", "::", "0:0:0:0:0:0:0:0"]);

function normalizeComments(comment: DohJsonResponse["Comment"]): string {
	if (!comment) return "";
	return Array.isArray(comment) ? comment.join(" ") : String(comment);
}

async function fetchDohJson(
	endpoint: string,
	hostname: string,
	timeoutMs: number,
): Promise<DohJsonResponse> {
	const queryUrl = `${endpoint}?name=${encodeURIComponent(hostname)}&type=A`;
	const response = await fetch(queryUrl, {
		method: "GET",
		headers: {
			Accept: "application/dns-json",
			"User-Agent": "LinksSecurityVerifier/2.0 (+https://links.mikeodnis.dev)",
		},
		signal: AbortSignal.timeout(timeoutMs),
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}`);
	}

	return (await response.json()) as DohJsonResponse;
}

/**
 * Check Cloudflare Security DNS (1.1.1.2 malware & phishing blocking resolver).
 * Blocked domains return A=0.0.0.0 and/or EDE(15)/EDE(16) Blocked/Censored comments.
 */
async function checkCloudflareSecurityDns(
	hostname: string,
	timeoutMs: number,
): Promise<{
	checked: boolean;
	hit: { provider: string; category: string; reason: string } | null;
	warning: string | null;
}> {
	try {
		const data = await fetchDohJson(CLOUDFLARE_SECURITY_DOH, hostname, timeoutMs);
		const comments = normalizeComments(data.Comment);
		const answers = data.Answer ?? [];

		const hasSinkholeAnswer = answers.some(
			(ans) => ans.type === 1 && ans.data && SINKHOLE_IPS.has(ans.data.trim()),
		);
		const hasBlockComment =
			/\b(?:blocked|censored|ede\(15\)|ede\(16\)|ede\(17\))\b/i.test(comments);

		if (hasSinkholeAnswer || hasBlockComment) {
			return {
				checked: true,
				hit: {
					provider: "Cloudflare Security DNS (1.1.1.2)",
					category: "MALWARE_OR_PHISHING",
					reason: comments
						? `Domain blocked by Cloudflare threat intelligence (${comments})`
						: "Domain sinkholed (0.0.0.0) by Cloudflare malware/phishing filter",
				},
				warning: null,
			};
		}

		return { checked: true, hit: null, warning: null };
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		return {
			checked: false,
			hit: null,
			warning: `Cloudflare Security DNS check unavailable (${msg})`,
		};
	}
}

/**
 * Check Quad9 Threat Intelligence DNS (9.9.9.9) via fast native DNS resolver.
 * Quad9 signals threat-blocked domains by returning NXDOMAIN (ENOTFOUND) or 0.0.0.0
 * on domains that otherwise resolve normally (verified by Phase 1 `domainResolvedInDns`).
 */
async function checkQuad9SecurityDns(
	hostname: string,
	timeoutMs: number,
	domainResolvedInDns: boolean,
): Promise<{
	checked: boolean;
	hit: { provider: string; category: string; reason: string } | null;
	warning: string | null;
}> {
	const resolver = new dns.Resolver({
		timeout: Math.min(timeoutMs, 1500),
		tries: 1,
	});
	resolver.setServers([QUAD9_DNS_SERVER]);

	try {
		const addresses = await resolver.resolve4(hostname);
		const hasSinkhole = addresses.some((ip) => SINKHOLE_IPS.has(ip.trim()));
		if (hasSinkhole) {
			return {
				checked: true,
				hit: {
					provider: "Quad9 Threat Intelligence DNS (9.9.9.9)",
					category: "MALWARE_OR_PHISHING",
					reason:
						"Domain sinkholed by Quad9 threat intelligence blocklist (phishing/malware feed)",
				},
				warning: null,
			};
		}
		return { checked: true, hit: null, warning: null };
	} catch (error: unknown) {
		const code =
			typeof error === "object" && error !== null && "code" in error
				? String((error as { code?: unknown }).code)
				: "";

		// Quad9 returns NXDOMAIN (ENOTFOUND) for threat-blocked domains.
		// Only flag as a threat block when Phase 1 already confirmed the domain resolves publicly.
		if (code === "ENOTFOUND" && domainResolvedInDns) {
			return {
				checked: true,
				hit: {
					provider: "Quad9 Threat Intelligence DNS (9.9.9.9)",
					category: "MALWARE_OR_PHISHING",
					reason:
						"Domain blocked (NXDOMAIN) by Quad9 threat intelligence blocklist",
				},
				warning: null,
			};
		}

		// ENODATA (IPv6-only domain) or genuine ENOTFOUND on unresolved host is not a blocklist hit
		if (code === "ENODATA" || code === "ENOTFOUND") {
			return { checked: true, hit: null, warning: null };
		}

		const msg = error instanceof Error ? error.message : String(error);
		return {
			checked: false,
			hit: null,
			warning: `Quad9 Threat Intelligence DNS check unavailable (${code || msg})`,
		};
	}
}

/**
 * Optional Abuse.ch URLhaus lookup (enabled when URLHAUS_AUTH_KEY is configured).
 */
async function checkUrlhaus(
	url: string,
	timeoutMs: number,
): Promise<{
	checked: boolean;
	hit: { provider: string; category: string; reason: string } | null;
	warning: string | null;
}> {
	const authKey = process.env.URLHAUS_AUTH_KEY?.trim();
	if (!authKey) {
		return { checked: false, hit: null, warning: null };
	}

	try {
		const body = new URLSearchParams({ url });
		const response = await fetch(URLHAUS_API_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"Auth-Key": authKey,
				"User-Agent": "LinksSecurityVerifier/2.0 (+https://links.mikeodnis.dev)",
			},
			body: body.toString(),
			signal: AbortSignal.timeout(timeoutMs),
		});

		if (!response.ok) {
			return {
				checked: false,
				hit: null,
				warning: `URLhaus API returned HTTP ${response.status}`,
			};
		}

		const data = (await response.json()) as {
			query_status?: string;
			threat?: string;
			url_status?: string;
			tags?: readonly string[];
		};

		if (data.query_status === "ok") {
			const threatLabel = data.threat || "malware_download";
			const tagSuffix =
				data.tags && data.tags.length > 0 ? ` [${data.tags.join(", ")}]` : "";
			return {
				checked: true,
				hit: {
					provider: "Abuse.ch URLhaus",
					category: threatLabel.toUpperCase(),
					reason: `URL listed in Abuse.ch URLhaus (${data.url_status || "flagged"}: ${threatLabel})${tagSuffix}`,
				},
				warning: null,
			};
		}

		return { checked: true, hit: null, warning: null };
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		return {
			checked: false,
			hit: null,
			warning: `URLhaus check unavailable (${msg})`,
		};
	}
}

/**
 * Run zero-key DNSBL & threat intelligence checks on a destination URL.
 */
export async function checkThreatIntel(
	url: string,
	options: ThreatIntelOptions = {},
): Promise<ThreatIntelCheckResult> {
	const startTime = Date.now();
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const domainResolvedInDns = options.domainResolvedInDns ?? true;

	let hostname = "";
	try {
		hostname = new URL(url).hostname.toLowerCase().replace(/\.+$/, "");
	} catch {
		return new ThreatIntelCheckResult({
			isSafe: true,
			url,
			hostname: "",
			checkedProviders: [],
			blockedBy: [],
			errors: [],
			warnings: ["Skipped threat intelligence check for unparseable URL"],
			checkTime: Date.now() - startTime,
		});
	}

	const cacheKey = `${hostname}::${url}::${domainResolvedInDns ? "1" : "0"}`;
	if (!options.skipCache) {
		const cached = threatIntelCache.get<ThreatIntelCheckResult>(cacheKey);
		if (cached) {
			return cached;
		}
	}

	const checkedProviders: string[] = [];
	const blockedBy: Array<{
		provider: string;
		category: string;
		reason: string;
	}> = [];
	const errors: string[] = [];
	const warnings: string[] = [];

	const isIpLiteral = classifyIpAddress(hostname).isIp;

	const checks: Array<
		Promise<{
			providerName: string;
			result: {
				checked: boolean;
				hit: { provider: string; category: string; reason: string } | null;
				warning: string | null;
			};
		}>
	> = [];

	// DNSBL resolvers operate on hostnames (not raw IP literals)
	if (!isIpLiteral) {
		checks.push(
			checkCloudflareSecurityDns(hostname, timeoutMs).then((result) => ({
				providerName: "Cloudflare Security DNS",
				result,
			})),
		);
		checks.push(
			checkQuad9SecurityDns(hostname, timeoutMs, domainResolvedInDns).then(
				(result) => ({
					providerName: "Quad9 Threat Intelligence",
					result,
				}),
			),
		);
	}

	checks.push(
		checkUrlhaus(url, timeoutMs).then((result) => ({
			providerName: "Abuse.ch URLhaus",
			result,
		})),
	);

	const settled = await Promise.all(checks);

	for (const { providerName, result } of settled) {
		if (result.checked) {
			checkedProviders.push(providerName);
		}
		if (result.hit) {
			blockedBy.push(result.hit);
			errors.push(`${result.hit.provider}: ${result.hit.reason}`);
		}
		if (result.warning) {
			warnings.push(result.warning);
		}
	}

	const output = new ThreatIntelCheckResult({
		isSafe: blockedBy.length === 0,
		url,
		hostname,
		checkedProviders,
		blockedBy,
		errors,
		warnings,
		checkTime: Date.now() - startTime,
	});

	if (checkedProviders.length > 0) {
		threatIntelCache.set(cacheKey, output);
	}

	return output;
}

export function clearThreatIntelCache(): void {
	threatIntelCache.flushAll();
}
