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
 * Link Verification Pipeline
 * Orchestrates all security checks with caching and comprehensive reporting using Effect Schema
 */

import * as S from "@effect/schema/Schema";
import NodeCache from "node-cache";
import { checkDns, DnsCheckResult } from "./dns-checker";
import {
	checkMalware,
	checkSuspiciousPatterns,
	MalwareCheckResult,
} from "./malware-checker";
import { detectPhishing, PhishingCheckResult } from "./phishing-detector";
import { checkSsl, SslCheckResult } from "./ssl-checker";
import { UrlValidationResult, validateUrl } from "./url-validator";

// Cache verification results for 1 hour
const verificationCache = new NodeCache({ stdTTL: 3600 });

// Effect Schema for verification options
export class VerificationOptions extends S.Class<VerificationOptions>(
	"VerificationOptions",
)({
	skipCache: S.optional(S.Boolean),
	skipDns: S.optional(S.Boolean),
	skipSsl: S.optional(S.Boolean),
	skipMalware: S.optional(S.Boolean),
	skipPhishing: S.optional(S.Boolean),
	timeout: S.optional(S.Number),
}) {}

// Effect Schema for verification metadata
export class VerificationMetadata extends S.Class<VerificationMetadata>(
	"VerificationMetadata",
)({
	verifiedAt: S.Date,
	totalCheckTime: S.Number,
	cached: S.Boolean,
}) {}

// Effect Schema for verification summary
export class VerificationSummary extends S.Class<VerificationSummary>(
	"VerificationSummary",
)({
	totalErrors: S.Number,
	totalWarnings: S.Number,
	criticalIssues: S.Array(S.String),
	recommendations: S.Array(S.String),
}) {}

// Effect Schema for verification checks
export class VerificationChecks extends S.Class<VerificationChecks>(
	"VerificationChecks",
)({
	urlValidation: S.instanceOf(UrlValidationResult),
	dnsCheck: S.instanceOf(DnsCheckResult),
	sslCheck: S.instanceOf(SslCheckResult),
	phishingCheck: S.instanceOf(PhishingCheckResult),
	malwareCheck: S.instanceOf(MalwareCheckResult),
}) {}

// Effect Schema for link verification result
export class LinkVerificationResult extends S.Class<LinkVerificationResult>(
	"LinkVerificationResult",
)({
	url: S.String,
	isVerified: S.Boolean,
	overallRisk: S.Literal("safe", "low", "medium", "high", "critical"),
	riskScore: S.Number, // 0-100
	checks: S.Struct({
		urlValidation: S.Any, // Using Any since instanceOf causes issues with circular references
		dnsCheck: S.Any,
		sslCheck: S.Any,
		phishingCheck: S.Any,
		malwareCheck: S.Any,
	}),
	summary: S.Struct({
		totalErrors: S.Number,
		totalWarnings: S.Number,
		criticalIssues: S.Array(S.String),
		recommendations: S.Array(S.String),
	}),
	metadata: S.Struct({
		verifiedAt: S.Date,
		totalCheckTime: S.Number,
		cached: S.Boolean,
	}),
}) {}

/**
 * Comprehensive link verification pipeline
 */
export async function verifyLink(
	url: string,
	options: Partial<VerificationOptions> = {},
): Promise<LinkVerificationResult> {
	const startTime = Date.now();

	// Check cache first
	if (!options.skipCache) {
		const cached = verificationCache.get<LinkVerificationResult>(url);
		if (cached) {
			return new LinkVerificationResult({
				...cached,
				metadata: {
					...cached.metadata,
					cached: true,
				},
			});
		}
	}

	// Run all checks in parallel for performance
	const [urlValidation, dnsCheck, sslCheck, phishingCheck, malwareCheck] =
		await Promise.all([
			validateUrl(url),
			options.skipDns
				? createSkippedDnsResult(new URL(url).hostname)
				: checkDns(new URL(url).hostname),
			options.skipSsl ? createSkippedSslResult(url) : checkSsl(url),
			options.skipPhishing
				? createSkippedPhishingResult(url)
				: detectPhishing(url),
			options.skipMalware ? createSkippedMalwareResult(url) : checkMalware(url),
		]);

	// Calculate overall risk score
	const riskScore = calculateRiskScore({
		urlValidation,
		dnsCheck,
		sslCheck,
		phishingCheck,
		malwareCheck,
	});

	// Determine overall risk level
	const overallRisk = getRiskLevel(riskScore);

	// Collect all errors and warnings
	const allErrors = [
		...urlValidation.errors,
		...dnsCheck.errors,
		...sslCheck.errors,
		...malwareCheck.errors,
	];

	const allWarnings = [
		...urlValidation.warnings,
		...dnsCheck.warnings,
		...sslCheck.warnings,
		...phishingCheck.warnings,
		...malwareCheck.warnings,
	];

	// Identify critical issues
	const criticalIssues: string[] = [];

	if (!urlValidation.isValid) {
		criticalIssues.push("URL format is invalid");
	}

	if (!dnsCheck.isValid) {
		criticalIssues.push("Domain does not exist or has DNS issues");
	}

	if (phishingCheck.isPhishing) {
		criticalIssues.push(
			`Potential phishing detected (${phishingCheck.suspicionScore}% confidence)`,
		);
	}

	if (!malwareCheck.isSafe) {
		for (const threat of malwareCheck.threats) {
			criticalIssues.push(`${threat.threatType}: ${threat.description}`);
		}
	}

	// Additional pattern checks
	const patternCheck = checkSuspiciousPatterns(url);
	if (patternCheck.suspicious) {
		criticalIssues.push(...patternCheck.patterns);
	}

	// Generate recommendations
	const recommendations = generateRecommendations({
		urlValidation,
		dnsCheck,
		sslCheck,
		phishingCheck,
		malwareCheck,
	});

	// Determine if link is verified (safe to use)
	const isVerified =
		allErrors.length === 0 && criticalIssues.length === 0 && riskScore < 50;

	const result = new LinkVerificationResult({
		url,
		isVerified,
		overallRisk,
		riskScore,
		checks: {
			urlValidation,
			dnsCheck,
			sslCheck,
			phishingCheck,
			malwareCheck,
		},
		summary: {
			totalErrors: allErrors.length,
			totalWarnings: allWarnings.length,
			criticalIssues,
			recommendations,
		},
		metadata: {
			verifiedAt: new Date(),
			totalCheckTime: Date.now() - startTime,
			cached: false,
		},
	});

	// Cache the result
	verificationCache.set(url, result);

	return result;
}

/**
 * Calculate overall risk score (0-100)
 */
function calculateRiskScore(checks: {
	urlValidation: UrlValidationResult;
	dnsCheck: DnsCheckResult;
	sslCheck: SslCheckResult;
	phishingCheck: PhishingCheckResult;
	malwareCheck: MalwareCheckResult;
}): number {
	let score = 0;

	// URL validation errors (25 points)
	if (!checks.urlValidation.isValid) {
		score += 25;
	}

	// DNS errors (20 points)
	if (!checks.dnsCheck.isValid) {
		score += 20;
	}

	// SSL errors (15 points)
	if (!checks.sslCheck.isValid) {
		score += 15;
	}

	// Phishing score (max 30 points)
	score += (checks.phishingCheck.suspicionScore / 100) * 30;

	// Malware threats (30 points for any threat)
	if (!checks.malwareCheck.isSafe) {
		score += 30;
	}

	// Warning penalties (1 point per warning, max 10)
	const totalWarnings =
		checks.urlValidation.warnings.length +
		checks.dnsCheck.warnings.length +
		checks.sslCheck.warnings.length +
		checks.phishingCheck.warnings.length +
		checks.malwareCheck.warnings.length;
	score += Math.min(totalWarnings, 10);

	return Math.min(Math.round(score), 100);
}

/**
 * Convert risk score to risk level
 */
function getRiskLevel(
	score: number,
): "safe" | "low" | "medium" | "high" | "critical" {
	if (score >= 80) return "critical";
	if (score >= 60) return "high";
	if (score >= 40) return "medium";
	if (score >= 20) return "low";
	return "safe";
}

/**
 * Generate security recommendations
 */
function generateRecommendations(checks: {
	urlValidation: UrlValidationResult;
	dnsCheck: DnsCheckResult;
	sslCheck: SslCheckResult;
	phishingCheck: PhishingCheckResult;
	malwareCheck: MalwareCheckResult;
}): string[] {
	const recommendations: string[] = [];

	// URL recommendations
	if (checks.urlValidation.protocol === "http") {
		recommendations.push("Upgrade to HTTPS for better security");
	}

	// DNS recommendations
	if (!checks.dnsCheck.hasMxRecord && checks.dnsCheck.hasARecord) {
		recommendations.push(
			"Domain has no email records - may be newly registered",
		);
	}

	// SSL recommendations
	if (
		checks.sslCheck.daysUntilExpiration &&
		checks.sslCheck.daysUntilExpiration < 30
	) {
		recommendations.push(
			"SSL certificate expiring soon - verify site legitimacy",
		);
	}

	// Phishing recommendations
	if (checks.phishingCheck.suspicionScore > 30) {
		recommendations.push(
			"URL shows signs of phishing - verify authenticity before sharing",
		);
	}

	if (checks.phishingCheck.reasons.length > 0) {
		recommendations.push(
			"Manual review recommended due to suspicious patterns",
		);
	}

	// Malware recommendations
	if (checks.malwareCheck.threats.length > 0) {
		recommendations.push(
			"DO NOT SHARE - URL flagged as malicious by security providers",
		);
	}

	// General recommendations
	if (recommendations.length === 0) {
		recommendations.push("URL passed all security checks - safe to share");
	}

	return recommendations;
}

/**
 * Helper functions to create skipped check results
 */
function createSkippedDnsResult(hostname: string): DnsCheckResult {
	return new DnsCheckResult({
		isValid: true,
		hostname,
		hasARecord: false,
		hasAAAARecord: false,
		hasMxRecord: false,
		hasCnameRecord: false,
		aRecords: [],
		aaaaRecords: [],
		mxRecords: [],
		cnameRecords: [],
		errors: [],
		warnings: ["DNS check skipped"],
		resolutionTime: 0,
	});
}

function createSkippedSslResult(url: string): SslCheckResult {
	return new SslCheckResult({
		isValid: true,
		url,
		hasValidCertificate: false,
		errors: [],
		warnings: ["SSL check skipped"],
		checkTime: 0,
	});
}

function createSkippedPhishingResult(url: string): PhishingCheckResult {
	return new PhishingCheckResult({
		isPhishing: false,
		suspicionScore: 0,
		url,
		domain: "",
		reasons: [],
		warnings: ["Phishing check skipped"],
	});
}

function createSkippedMalwareResult(url: string): MalwareCheckResult {
	return new MalwareCheckResult({
		isSafe: true,
		url,
		threats: [],
		checkedBy: [],
		errors: [],
		warnings: ["Malware check skipped"],
		checkTime: 0,
	});
}

/**
 * Clear verification cache
 */
export function clearVerificationCache() {
	verificationCache.flushAll();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
	return verificationCache.getStats();
}
