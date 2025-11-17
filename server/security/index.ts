/**
 * Security Module Exports
 * Central export point for all security verification utilities
 */

// DNS Checking
export {
	checkDns,
	type DnsCheckResult,
	domainExists,
} from "./dns-checker";
// Malware Scanning
export {
	checkMalware,
	checkSuspiciousPatterns,
	type MalwareCheckResult,
	type ThreatMatch,
} from "./malware-checker";
// Phishing Detection
export {
	detectPhishing,
	type PhishingCheckResult,
} from "./phishing-detector";
// SSL/TLS Verification
export {
	checkSsl,
	type SslCheckResult,
} from "./ssl-checker";
// URL Validation
export {
	isValidUrlFormat,
	SecureUrlSchema,
	type UrlValidationResult,
	validateUrl,
} from "./url-validator";

// Verification Pipeline
export {
	clearVerificationCache,
	getCacheStats,
	type LinkVerificationResult,
	type VerificationOptions,
	verifyLink,
} from "./verification-pipeline";
