/**
 * Phishing Detection Module
 * Uses heuristics and pattern matching to detect potential phishing URLs with Effect Schema
 */

import * as S from "@effect/schema/Schema";

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

// Common legitimate domains that phishers try to impersonate
const LEGITIMATE_DOMAINS = [
	"google",
	"facebook",
	"amazon",
	"apple",
	"microsoft",
	"paypal",
	"netflix",
	"instagram",
	"twitter",
	"linkedin",
	"github",
	"dropbox",
	"yahoo",
	"outlook",
	"live",
	"office",
	"adobe",
	"spotify",
	"ebay",
	"walmart",
	"target",
	"bestbuy",
	"chase",
	"bankofamerica",
	"wellsfargo",
];

// Suspicious TLDs commonly used in phishing
const SUSPICIOUS_TLDS = [
	".tk",
	".ml",
	".ga",
	".cf",
	".gq", // Free domains
	".zip",
	".mov",
	".exe", // Confusing extensions
];

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
];

/**
 * Parse domain from hostname
 */
function parseDomain(hostname: string): { domain: string; subdomain: string } {
	const parts = hostname.split(".");
	const domain = parts.length >= 2 ? parts.slice(-2).join(".") : hostname;
	const subdomain = parts.length > 2 ? parts.slice(0, -2).join(".") : "";
	return { domain, subdomain };
}

/**
 * Detect potential phishing attempts using multiple heuristics
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

	const hostname = parsedUrl.hostname;
	const { domain, subdomain } = parseDomain(hostname);

	// Check 1: Homograph attacks (Unicode lookalikes)
	if (/[^\x00-\x7F]/.test(hostname)) {
		suspicionScore += 30;
		reasons.push(
			"Domain contains non-ASCII characters (possible homograph attack)",
		);
	}

	// Check 2: Multiple suspicious keywords
	const foundKeywords = PHISHING_KEYWORDS.filter((keyword) =>
		urlLower.includes(keyword),
	);
	if (foundKeywords.length >= 2) {
		suspicionScore += 25;
		reasons.push(
			`Contains multiple phishing keywords: ${foundKeywords.join(", ")}`,
		);
	} else if (foundKeywords.length === 1) {
		suspicionScore += 10;
		warnings.push(`Contains phishing keyword: ${foundKeywords[0]}`);
	}

	// Check 3: Typosquatting (similar to legitimate domains)
	for (const legit of LEGITIMATE_DOMAINS) {
		if (domain.includes(legit) && domain !== `${legit}.com`) {
			const similarity = calculateSimilarity(domain, `${legit}.com`);
			if (similarity > 0.7) {
				suspicionScore += 35;
				reasons.push(
					`Domain closely resembles legitimate brand: ${legit} (similarity: ${(similarity * 100).toFixed(0)}%)`,
				);
			}
		}

		// Check if legitimate brand is in subdomain (e.g., paypal.malicious.com)
		if (subdomain.includes(legit)) {
			suspicionScore += 40;
			reasons.push(`Legitimate brand name in subdomain: ${legit}`);
		}
	}

	// Check 4: Suspicious TLD
	const tld = domain.split(".").pop() || "";
	if (SUSPICIOUS_TLDS.some((suspicious) => `.${tld}` === suspicious)) {
		suspicionScore += 20;
		reasons.push(`Uses suspicious TLD: .${tld}`);
	}

	// Check 5: Excessive subdomains
	const subdomainParts = subdomain.split(".").filter(Boolean);
	if (subdomainParts.length > 3) {
		suspicionScore += 15;
		warnings.push(`Excessive subdomains (${subdomainParts.length} levels)`);
	}

	// Check 6: IP address instead of domain
	const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
	if (ipRegex.test(hostname)) {
		suspicionScore += 30;
		reasons.push("Uses IP address instead of domain name");
	}

	// Check 7: @ symbol in URL (credential phishing)
	if (url.includes("@")) {
		suspicionScore += 35;
		reasons.push("Contains @ symbol (possible credential injection)");
	}

	// Check 8: Excessive hyphens (e.g., pay-pal-secure-login.com)
	const hyphenCount = domain.split("-").length - 1;
	if (hyphenCount > 2) {
		suspicionScore += 20;
		reasons.push(`Excessive hyphens in domain (${hyphenCount})`);
	}

	// Check 9: Numbers in suspicious positions
	if (/\d+/.test(domain) && foundKeywords.length > 0) {
		suspicionScore += 15;
		warnings.push("Domain contains numbers along with sensitive keywords");
	}

	// Check 10: Very long domain name
	if (domain.length > 30) {
		suspicionScore += 10;
		warnings.push(`Unusually long domain name (${domain.length} characters)`);
	}

	// Check 11: Shortened URL redirect patterns
	const shortenerPatterns = [
		"bit.ly",
		"tinyurl",
		"goo.gl",
		"ow.ly",
		"t.co",
		"short.link",
		"tiny.cc",
		"cutt.ly",
		"rebrand.ly",
	];
	if (shortenerPatterns.some((pattern) => hostname.includes(pattern))) {
		suspicionScore += 5;
		warnings.push("URL uses a URL shortener (destination unknown)");
	}

	// Cap suspicion score at 100
	suspicionScore = Math.min(suspicionScore, 100);

	// Determine if it's phishing based on score
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
		matrix[0][j] = j;
	}

	for (let i = 1; i <= str2.length; i++) {
		for (let j = 1; j <= str1.length; j++) {
			if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
				matrix[i][j] = matrix[i - 1][j - 1];
			} else {
				matrix[i][j] = Math.min(
					matrix[i - 1][j - 1] + 1, // substitution
					matrix[i][j - 1] + 1, // insertion
					matrix[i - 1][j] + 1, // deletion
				);
			}
		}
	}

	return matrix[str2.length][str1.length];
}
