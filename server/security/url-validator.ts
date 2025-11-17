/**
 * URL Validation Security Module
 * Validates URL format, domain, TLD, and structure using Deno and Effect Schema
 */

import * as S from "@effect/schema/Schema";

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

/**
 * Parse domain components from hostname
 */
function parseDomain(hostname: string): {
	domain: string;
	tld: string | null;
	subdomain: string | null;
} {
	const parts = hostname.split(".");

	if (parts.length < 2) {
		return { domain: hostname, tld: null, subdomain: null };
	}

	// Simple TLD extraction (last part)
	const tld = parts[parts.length - 1];

	// Domain is second-to-last part + TLD
	const domain =
		parts.length >= 2 ? `${parts[parts.length - 2]}.${tld}` : hostname;

	// Subdomain is everything before the domain
	const subdomain = parts.length > 2 ? parts.slice(0, -2).join(".") : null;

	return { domain, tld, subdomain };
}

/**
 * Comprehensive URL validation with security checks
 */
export async function validateUrl(url: string): Promise<UrlValidationResult> {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Parse the URL using native URL API
	let parsedUrl: URL;

	try {
		parsedUrl = new URL(url);
	} catch (error) {
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
	const protocol = parsedUrl.protocol.replace(":", "");
	if (!["http", "https"].includes(protocol)) {
		errors.push(
			`Invalid protocol: ${protocol}. Only HTTP and HTTPS are allowed`,
		);
	}

	// HTTPS recommendation
	if (protocol === "http") {
		warnings.push("Consider using HTTPS for better security");
	}

	// Domain validation
	const hostname = parsedUrl.hostname;
	if (!hostname) {
		errors.push("Missing hostname");
	} else {
		// Check for IP addresses (potential security risk)
		const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
		const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

		if (ipv4Regex.test(hostname) || ipv6Regex.test(hostname)) {
			warnings.push("URL uses IP address instead of domain name");
		}

		// Check for localhost or private networks
		if (
			hostname === "localhost" ||
			hostname === "127.0.0.1" ||
			hostname === "::1" ||
			hostname.endsWith(".local") ||
			hostname.startsWith("192.168.") ||
			hostname.startsWith("10.") ||
			/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
		) {
			errors.push(
				"URLs pointing to localhost or private networks are not allowed",
			);
		}

		// Check for valid domain characters
		if (!/^[a-zA-Z0-9.-]+$/.test(hostname)) {
			errors.push("Domain contains invalid characters");
		}
	}

	// Parse domain components
	const { domain, tld, subdomain } = parseDomain(hostname);

	// TLD validation
	if (!tld || tld.length < 2) {
		errors.push("Invalid or missing top-level domain (TLD)");
	}

	// Check for suspicious patterns
	if (url.includes("@")) {
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

	// Check URL length (extremely long URLs can be suspicious)
	if (url.length > 2000) {
		warnings.push("URL is extremely long, which may indicate malicious intent");
	}

	// Check for homograph attacks (unicode characters that look like ASCII)
	if (/[^\x00-\x7F]/.test(hostname)) {
		warnings.push(
			"Domain contains non-ASCII characters (possible homograph attack)",
		);
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
