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
