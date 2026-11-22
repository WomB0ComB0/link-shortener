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
 * Phishing Detection Module
 * Strict heuristics for IDN/punycode homographs, leet-speak brand typosquatting,
 * credential injection, nested dangerous schemes, high-abuse TLDs, and shortener chaining.
 */

import * as S from "@effect/schema/Schema";
import { classifyIpAddress } from "./ip-utils";

// Effect Schema for phishing check result
export class PhishingCheckResult extends S.Class<PhishingCheckResult>(
	"PhishingCheckResult",
)({
	isPhishing: S.Boolean,
	suspicionScore: S.Number, // 0-100, higher = more suspicious
	url: S.String,
	domain: S.String,
	reasons: S.Array(S.String),
	warnings: S.Array(S.String),
}) {}

// High-value brands commonly targeted by credential phishing
const LEGITIMATE_BRANDS: ReadonlyArray<{
	readonly brand: string;
	readonly officialDomains: readonly string[];
}> = [
	{ brand: "google", officialDomains: ["google.com", "google.dev", "googleapis.com", "googleusercontent.com"] },
	{ brand: "facebook", officialDomains: ["facebook.com", "fb.com"] },
	{ brand: "amazon", officialDomains: ["amazon.com", "amazonaws.com"] },
	{ brand: "apple", officialDomains: ["apple.com", "icloud.com"] },
	{ brand: "microsoft", officialDomains: ["microsoft.com", "microsoftonline.com"] },
	{ brand: "paypal", officialDomains: ["paypal.com", "paypal.me"] },
	{ brand: "netflix", officialDomains: ["netflix.com"] },
	{ brand: "instagram", officialDomains: ["instagram.com"] },
	{ brand: "twitter", officialDomains: ["twitter.com"] },
	{ brand: "linkedin", officialDomains: ["linkedin.com"] },
	{ brand: "github", officialDomains: ["github.com", "github.io", "githubusercontent.com"] },
	{ brand: "dropbox", officialDomains: ["dropbox.com"] },
	{ brand: "yahoo", officialDomains: ["yahoo.com"] },
	{ brand: "outlook", officialDomains: ["outlook.com"] },
	{ brand: "office", officialDomains: ["office.com"] },
	{ brand: "adobe", officialDomains: ["adobe.com"] },
	{ brand: "spotify", officialDomains: ["spotify.com"] },
	{ brand: "ebay", officialDomains: ["ebay.com"] },
	{ brand: "walmart", officialDomains: ["walmart.com"] },
	{ brand: "chase", officialDomains: ["chase.com"] },
	{ brand: "bankofamerica", officialDomains: ["bankofamerica.com"] },
	{ brand: "wellsfargo", officialDomains: ["wellsfargo.com"] },
	{ brand: "stripe", officialDomains: ["stripe.com"] },
	{ brand: "coinbase", officialDomains: ["coinbase.com"] },
	{ brand: "binance", officialDomains: ["binance.com"] },
	{ brand: "metamask", officialDomains: ["metamask.io"] },
	{ brand: "discord", officialDomains: ["discord.com", "discord.gg"] },
	{ brand: "cloudflare", officialDomains: ["cloudflare.com"] },
	{ brand: "openai", officialDomains: ["openai.com"] },
	{ brand: "anthropic", officialDomains: ["anthropic.com"] },
];

// High-abuse TLDs frequently observed in phishing campaigns
const SUSPICIOUS_TLDS = new Set([
	".tk",
	".ml",
	".ga",
	".cf",
	".gq",
	".zip",
	".mov",
	".exe",
	".top",
	".xyz",
	".click",
	".cfd",
	".loan",
	".work",
	".buzz",
	".surf",
	".rest",
]);

// Keywords commonly found in phishing URLs
const PHISHING_KEYWORDS = [
	"verify",
	"account",
	"update",
	"confirm",
	"login",
	"signin",
	"secure",
	"banking",
	"suspended",
	"locked",
	"unusual",
	"activity",
	"validate",
	"restore",
	"recover",
	"wallet",
	"payment",
	"billing",
	"invoice",
	"password",
	"credential",
	"authenticate",
	"seedphrase",
	"airdrop",
];

// Known public URL shorteners (chaining shorteners hides destination)
const SHORTENER_DOMAINS = new Set([
	"bit.ly",
	"tinyurl.com",
	"goo.gl",
	"ow.ly",
	"t.co",
	"short.link",
	"tiny.cc",
	"cutt.ly",
	"rebrand.ly",
	"is.gd",
	"v.gd",
	"rb.gy",
	"s.id",
	"shorturl.at",
	"bl.ink",
	"lnkd.in",
]);

/**
 * Parse domain from hostname
 */
function parseDomain(hostname: string): { domain: string; subdomain: string } {
	const cleaned = hostname.toLowerCase().replace(/\.+$/, "");
	const parts = cleaned.split(".");
	const domain = parts.length >= 2 ? parts.slice(-2).join(".") : cleaned;
	const subdomain = parts.length > 2 ? parts.slice(0, -2).join(".") : "";
	return { domain, subdomain };
}

/**
 * Normalize common leetspeak & visual lookalikes (e.g., paypa1 -> paypal, g00gle -> google, rn -> m)
 */
function toVisualSkeleton(label: string): string {
	return label
		.toLowerCase()
		.replace(/0/g, "o")
		.replace(/1/g, "l")
		.replace(/3/g, "e")
		.replace(/4/g, "a")
		.replace(/5/g, "s")
		.replace(/7/g, "t")
		.replace(/8/g, "b")
		.replace(/rn/g, "m")
		.replace(/vv/g, "w");
}

/**
 * Detect potential phishing attempts using multi-signal heuristics
 */
export async function detectPhishing(
	url: string,
): Promise<PhishingCheckResult> {
	const reasons: string[] = [];
	const warnings: string[] = [];
	let suspicionScore = 0;

	const urlLower = url.toLowerCase();

	let parsedUrl: URL;
	try {
		parsedUrl = new URL(url);
	} catch {
		return new PhishingCheckResult({
			isPhishing: false,
			suspicionScore: 0,
			url,
			domain: "",
			reasons: ["Invalid URL format"],
			warnings: [],
		});
	}

	const hostname = parsedUrl.hostname.toLowerCase();
	const { domain, subdomain } = parseDomain(hostname);
	const domainLabel = domain.split(".")[0] || "";
	const domainSkeleton = toVisualSkeleton(domainLabel);

	// Check 1: IDN Punycode / Unicode homograph attacks
	const hasPunycode = hostname
		.split(".")
		.some((label) => label.startsWith("xn--"));
	if (hasPunycode || /[^\x00-\x7F]/.test(hostname)) {
		suspicionScore += 35;
		reasons.push(
			"Domain uses internationalized/punycode characters (possible homograph attack)",
		);
	}

	// Check 2: Embedded URL credentials (user:pass@host)
	if (parsedUrl.username || parsedUrl.password) {
		suspicionScore += 45;
		reasons.push("Contains embedded URL credentials (credential phishing pattern)");
	} else if (url.includes("@")) {
		suspicionScore += 35;
		reasons.push("Contains @ symbol (possible credential injection)");
	}

	// Check 3: Nested dangerous URI schemes in query/hash
	if (/(?:javascript|vbscript|data\s*:\s*text\/html)\s*:/i.test(url)) {
		suspicionScore += 60;
		reasons.push("Contains embedded executable URI scheme");
	}

	// Check 4: Multiple phishing keywords
	const foundKeywords = PHISHING_KEYWORDS.filter((keyword) =>
		urlLower.includes(keyword),
	);
	if (foundKeywords.length >= 3) {
		suspicionScore += 35;
		reasons.push(
			`Contains multiple phishing keywords: ${foundKeywords.join(", ")}`,
		);
	} else if (foundKeywords.length >= 2) {
		suspicionScore += 25;
		reasons.push(
			`Contains multiple phishing keywords: ${foundKeywords.join(", ")}`,
		);
	} else if (foundKeywords.length === 1) {
		suspicionScore += 10;
		warnings.push(`Contains phishing keyword: ${foundKeywords[0]}`);
	}

	// Check 5: Brand impersonation & typosquatting (exact, substring, and leet/homoglyph skeleton)
	for (const entry of LEGITIMATE_BRANDS) {
		const isOfficial = entry.officialDomains.some(
			(official) => domain === official || hostname.endsWith(`.${official}`),
		);
		if (isOfficial) continue;

		// Brand name in subdomain of a third-party domain (e.g., paypal.evil.com)
		if (subdomain.includes(entry.brand) || toVisualSkeleton(subdomain).includes(entry.brand)) {
			suspicionScore += 45;
			reasons.push(`Legitimate brand name in subdomain: ${entry.brand}`);
			continue;
		}

		// Brand embedded in an unofficial domain (e.g., paypal-verify.com)
		if (domainLabel.includes(entry.brand) || domainSkeleton.includes(entry.brand)) {
			suspicionScore += 40;
			reasons.push(`Domain impersonates legitimate brand: ${entry.brand}`);
			continue;
		}

		// Fuzzy typosquatting via Levenshtein distance on visual skeleton (e.g., g00gle.com, paypa1.com, githab.com)
		if (
			entry.brand.length >= 5 &&
			Math.abs(domainSkeleton.length - entry.brand.length) <= 2
		) {
			const distance = levenshteinDistance(domainSkeleton, entry.brand);
			const similarity = calculateSimilarity(domainSkeleton, entry.brand);
			if (distance <= 1 || similarity >= 0.82) {
				suspicionScore += 40;
				reasons.push(
					`Domain closely resembles legitimate brand: ${entry.brand} (similarity: ${(similarity * 100).toFixed(0)}%)`,
				);
			}
		}
	}

	// Check 6: High-abuse / deceptive TLD
	const tld = domain.split(".").pop() || "";
	if (SUSPICIOUS_TLDS.has(`.${tld}`)) {
		suspicionScore += 20;
		reasons.push(`Uses suspicious TLD: .${tld}`);
	}

	// Check 7: Excessive subdomains
	const subdomainParts = subdomain.split(".").filter(Boolean);
	if (subdomainParts.length > 3) {
		suspicionScore += 20;
		reasons.push(`Excessive subdomains (${subdomainParts.length} levels)`);
	}

	// Check 8: Raw IP address (IPv4 or IPv6) instead of domain
	const ipInfo = classifyIpAddress(hostname);
	if (ipInfo.isIp) {
		suspicionScore += 40;
		reasons.push("Uses raw IP address instead of domain name");
	}

	// Check 9: Excessive hyphens in registered domain (e.g., pay-pal-secure-login.com)
	const hyphenCount = domainLabel.split("-").length - 1;
	if (hyphenCount >= 3) {
		suspicionScore += 25;
		reasons.push(`Excessive hyphens in domain (${hyphenCount})`);
	}

	// Check 10: Numbers mixed with phishing keywords in domain
	if (/\d+/.test(domainLabel) && foundKeywords.length > 0) {
		suspicionScore += 15;
		warnings.push("Domain contains numbers along with sensitive keywords");
	}

	// Check 11: Unusually long registered domain
	if (domain.length > 30) {
		suspicionScore += 10;
		warnings.push(`Unusually long domain name (${domain.length} characters)`);
	}

	// Check 12: Chained URL shortener (obfuscates true destination)
	if (
		SHORTENER_DOMAINS.has(domain) ||
		SHORTENER_DOMAINS.has(hostname)
	) {
		suspicionScore += 20;
		warnings.push("URL uses another URL shortener (destination obfuscated)");
	}

	// Cap suspicion score at 100
	suspicionScore = Math.min(suspicionScore, 100);

	// Strict threshold: 50+ flags phishing
	const isPhishing = suspicionScore >= 50;

	return new PhishingCheckResult({
		isPhishing,
		suspicionScore,
		url,
		domain,
		reasons,
		warnings,
	});
}

/**
 * Calculate similarity between two strings (Levenshtein distance)
 */
function calculateSimilarity(str1: string, str2: string): number {
	const longer = str1.length > str2.length ? str1 : str2;
	const shorter = str1.length > str2.length ? str2 : str1;

	if (longer.length === 0) {
		return 1.0;
	}

	const distance = levenshteinDistance(longer, shorter);
	return (longer.length - distance) / longer.length;
}

/**
 * Levenshtein distance algorithm
 */
function levenshteinDistance(str1: string, str2: string): number {
	const matrix: number[][] = [];

	for (let i = 0; i <= str2.length; i++) {
		matrix[i] = [i];
	}

	for (let j = 0; j <= str1.length; j++) {
		matrix[0]![j] = j;
	}

	for (let i = 1; i <= str2.length; i++) {
		for (let j = 1; j <= str1.length; j++) {
			if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
				matrix[i]![j] = matrix[i - 1]![j - 1]!;
			} else {
				matrix[i]![j] = Math.min(
					matrix[i - 1]![j - 1]! + 1,
					matrix[i]![j - 1]! + 1,
					matrix[i - 1]![j]! + 1,
				);
			}
		}
	}

	return matrix[str2.length]![str1.length]!;
}
