/**
 * Security Module Exports
 * Central export point for all security verification utilities
 */

// URL Validation
export {
	validateUrl,
	isValidUrlFormat,
	SecureUrlSchema,
	type UrlValidationResult,
} from "./url-validator";

// DNS Checking
export {
	checkDns,
	domainExists,
	type DnsCheckResult,
} from "./dns-checker";

// SSL/TLS Verification
export {
	checkSsl,
	type SslCheckResult,
} from "./ssl-checker";

// Phishing Detection
export {
	detectPhishing,
	type PhishingCheckResult,
} from "./phishing-detector";

// Malware Scanning
export {
	checkMalware,
	checkSuspiciousPatterns,
	type MalwareCheckResult,
	type ThreatMatch,
} from "./malware-checker";

// Verification Pipeline
export {
	verifyLink,
	clearVerificationCache,
	getCacheStats,
	type LinkVerificationResult,
	type VerificationOptions,
} from "./verification-pipeline";
