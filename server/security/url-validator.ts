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
 * URL Validation Security Module
 * Strict URL syntax, protocol, SSRF, port, credential, punycode, and payload guard.
 */

import * as S from "@effect/schema/Schema";
import { classifyIpAddress, isBlockedHostname } from "./ip-utils";

// Effect Schema for URL validation result
export class UrlValidationResult extends S.Class<UrlValidationResult>(
	"UrlValidationResult",
)({
	isValid: S.Boolean,
	url: S.String,
	protocol: S.String,
	domain: S.String,
	hostname: S.String,
	tld: S.NullOr(S.String),
	subdomain: S.NullOr(S.String),
	errors: S.Array(S.String),
	warnings: S.Array(S.String),
}) {}

const MAX_URL_LENGTH = 2048;
const ALLOWED_PORTS = new Set(["", "80", "443"]);

// Suspicious keywords commonly found in phishing URLs
const SUSPICIOUS_KEYWORDS = [
	"login",
	"signin",
	"verify",
	"account",
	"update",
	"secure",
	"banking",
	"paypal",
	"amazon",
	"apple",
	"microsoft",
	"google",
];

// Dangerous nested URI schemes inside query params or fragments
const NESTED_DANGEROUS_SCHEMES =
	/(?:^|[?&#=/])(?:javascript|vbscript|data\s*:\s*text\/html|file)\s*:/i;

/**
 * Parse domain components from hostname
 */
function parseDomain(hostname: string): {
	domain: string;
	tld: string | null;
	subdomain: string | null;
} {
	const cleaned = hostname.replace(/\.+$/, "");
	const parts = cleaned.split(".");

	if (parts.length < 2) {
		return { domain: cleaned, tld: null, subdomain: null };
	}

	const tld = parts[parts.length - 1] ?? null;
	const domain =
		parts.length >= 2 && tld ? `${parts[parts.length - 2]}.${tld}` : cleaned;
	const subdomain = parts.length > 2 ? parts.slice(0, -2).join(".") : null;

	return { domain, tld, subdomain };
}

/**
 * Comprehensive URL validation with strict SSRF & injection guards
 */
export async function validateUrl(url: string): Promise<UrlValidationResult> {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (typeof url !== "string" || url.trim().length === 0) {
		return new UrlValidationResult({
			isValid: false,
			url: String(url ?? ""),
			protocol: "",
			domain: "",
			hostname: "",
			tld: null,
			subdomain: null,
			errors: ["Invalid URL format"],
			warnings: [],
		});
	}

	// Reject ASCII control characters, CRLF, or embedded whitespace/null bytes
	if (/[\x00-\x1F\x7F]/.test(url) || /%00|%0d|%0a/i.test(url)) {
		errors.push("URL contains illegal control characters or null bytes");
	}

	// Hard cap on URL length to prevent parser abuse / DoS
	if (url.length > MAX_URL_LENGTH) {
		errors.push(`URL exceeds maximum allowed length of ${MAX_URL_LENGTH} characters`);
	}

	// Parse the URL using native WHATWG URL API
	let parsedUrl: URL;
	try {
		parsedUrl = new URL(url);
	} catch {
		return new UrlValidationResult({
			isValid: false,
			url,
			protocol: "",
			domain: "",
			hostname: "",
			tld: null,
			subdomain: null,
			errors: ["Invalid URL format"],
			warnings: [],
		});
	}

	// Protocol validation
	const protocol = parsedUrl.protocol.replace(":", "").toLowerCase();
	if (!["http", "https"].includes(protocol)) {
		errors.push(
			`Invalid protocol: ${protocol}. Only HTTP and HTTPS are allowed`,
		);
	}

	// HTTPS recommendation
	if (protocol === "http") {
		warnings.push("Consider using HTTPS for better security");
	}

	// Disallow embedded credentials (user:pass@host) - classic phishing/SSRF vector
	if (parsedUrl.username || parsedUrl.password) {
		errors.push("URLs with embedded credentials are not allowed");
	}

	// Disallow non-standard ports (prevents internal service / DB port probing)
	if (parsedUrl.port && !ALLOWED_PORTS.has(parsedUrl.port)) {
		errors.push(`Non-standard port :${parsedUrl.port} is not allowed`);
	}

	// Domain / IP validation
	const hostname = parsedUrl.hostname.toLowerCase();
	const ipInfo = classifyIpAddress(hostname);

	if (!hostname) {
		errors.push("Missing hostname");
	} else {
		if (ipInfo.isIp) {
			if (ipInfo.isRestricted) {
				errors.push(
					"URLs pointing to localhost or private networks are not allowed",
				);
			} else {
				warnings.push("URL uses IP address instead of domain name");
			}
		} else {
			const blockedHost = isBlockedHostname(hostname);
			if (blockedHost.blocked && blockedHost.reason) {
				errors.push(blockedHost.reason);
			}

			// Check for valid domain characters (after WHATWG punycode normalization)
			if (!/^[a-zA-Z0-9.-]+$/.test(hostname)) {
				errors.push("Domain contains invalid characters");
			}

			// Detect empty labels or malformed leading/trailing hyphens
			const labels = hostname.replace(/\.+$/, "").split(".");
			if (
				labels.some(
					(label) =>
						label.length === 0 ||
						label.length > 63 ||
						label.startsWith("-") ||
						label.endsWith("-"),
				)
			) {
				errors.push("Domain contains malformed DNS labels");
			}
		}
	}

	// Parse domain components
	const { domain, tld, subdomain } = ipInfo.isIp
		? { domain: ipInfo.normalized, tld: null, subdomain: null }
		: parseDomain(hostname);

	// TLD validation (skip for public raw IP addresses since they don't have TLDs)
	if (!ipInfo.isIp && (!tld || tld.length < 2 || /^\d+$/.test(tld))) {
		errors.push("Invalid or missing top-level domain (TLD)");
	}

	// Check for nested dangerous URI schemes in query/fragment
	const decodedSearchAndHash = `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
	let decodedPayload = decodedSearchAndHash;
	try {
		decodedPayload = decodeURIComponent(decodedSearchAndHash);
	} catch {
		// Malformed percent-encoding is itself suspicious
		warnings.push("URL contains malformed percent-encoding");
	}
	if (
		NESTED_DANGEROUS_SCHEMES.test(decodedSearchAndHash) ||
		NESTED_DANGEROUS_SCHEMES.test(decodedPayload)
	) {
		errors.push("URL contains embedded dangerous URI scheme");
	}

	// Check for double-encoded path traversal or obfuscation
	if (/%25(?:2e|2f|5c|00)/i.test(url)) {
		errors.push("URL contains suspicious double-encoded sequences");
	}

	// Check for @ symbol outside credentials (e.g., phishing path tricks)
	if (url.includes("@") && !parsedUrl.username && !parsedUrl.password) {
		warnings.push("URL contains @ symbol, which may be used for phishing");
	}

	// Check for excessive subdomains (potential typosquatting)
	if (subdomain && subdomain.split(".").length > 3) {
		warnings.push("URL has many subdomains, verify authenticity");
	}

	// Check for suspicious keywords in URL
	const urlLower = url.toLowerCase();
	const foundSuspiciousKeywords = SUSPICIOUS_KEYWORDS.filter(
		(keyword) =>
			urlLower.includes(keyword) && !domain?.toLowerCase().includes(keyword),
	);
	if (foundSuspiciousKeywords.length > 0) {
		warnings.push(
			`URL contains suspicious keywords: ${foundSuspiciousKeywords.join(", ")}`,
		);
	}

	// Check for IDN Punycode / homograph attacks
	// Note: WHATWG URL converts Unicode hostnames to ASCII xn-- punycode labels
	const hasPunycode = hostname
		.split(".")
		.some((label) => label.startsWith("xn--"));
	if (hasPunycode || /[^\x00-\x7F]/.test(hostname) || /[^\x00-\x7F]/.test(url)) {
		if (hasPunycode || /[^\x00-\x7F]/.test(hostname)) {
			warnings.push(
				"Domain uses internationalized/punycode characters (possible homograph attack)",
			);
		}
	}

	return new UrlValidationResult({
		isValid: errors.length === 0,
		url,
		protocol,
		domain: domain || hostname,
		hostname,
		tld: tld || null,
		subdomain: subdomain || null,
		errors,
		warnings,
	});
}

/**
 * Quick URL format validation
 */
export function isValidUrlFormat(url: string): boolean {
	try {
		const parsed = new URL(url);
		return ["http:", "https:"].includes(parsed.protocol);
	} catch {
		return false;
	}
}

/**
 * Effect Schema for secure URL validation
 */
export const SecureUrlSchema = S.String.pipe(
	S.filter(
		(url) => {
			try {
				const parsedUrl = new URL(url);
				return ["http:", "https:"].includes(parsedUrl.protocol);
			} catch {
				return false;
			}
		},
		{
			message: () => "Must be a valid HTTP or HTTPS URL",
		},
	),
);
