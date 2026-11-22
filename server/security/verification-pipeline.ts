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
 * Link Verification Pipeline (Strict 6-Stage Engine)
 * Two-phase SSRF-gated orchestrator:
 *   Phase 1 (SSRF Gate): URL validation + DNS private-IP/rebinding check
 *   Phase 2 (Active Inspection): SSL/TLS + Redirect chain + Phishing + Malware
 *   Phase 3 (Final Target Re-scan): Phishing + Malware + Pattern checks on final redirect URL
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
import { checkRedirects, RedirectCheckResult } from "./redirect-checker";
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
	skipRedirects: S.optional(S.Boolean),
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
	redirectCheck: S.instanceOf(RedirectCheckResult),
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
		urlValidation: S.Any,
		dnsCheck: S.Any,
		sslCheck: S.Any,
		redirectCheck: S.Any,
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

function buildCacheKey(
	url: string,
	options: Partial<VerificationOptions>,
): string {
	// Include skip flags in cache key so skipped checks can NEVER poison full verification results
	const flags = [
		options.skipDns ? "noDns" : "dns",
		options.skipSsl ? "noSsl" : "ssl",
		options.skipRedirects ? "noRedir" : "redir",
		options.skipPhishing ? "noPhish" : "phish",
		options.skipMalware ? "noMal" : "mal",
	].join("|");
	return `${flags}::${url}`;
}

/**
 * Comprehensive 6-stage strict link verification pipeline
 */
export async function verifyLink(
	url: string,
	options: Partial<VerificationOptions> = {},
): Promise<LinkVerificationResult> {
	const startTime = Date.now();
	const cacheKey = buildCacheKey(url, options);

	// Check cache first
	if (!options.skipCache) {
		const cached = verificationCache.get<LinkVerificationResult>(cacheKey);
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

	// ================================================================
	// PHASE 1: Local URL Validation + DNS SSRF Gate (before any HTTP/TLS socket)
	// ================================================================
	const urlValidation = await validateUrl(url);

	const hostname = urlValidation.hostname;
	const dnsCheck = options.skipDns
		? createSkippedDnsResult(hostname)
		: urlValidation.isValid && hostname
			? await checkDns(hostname)
			: createBlockedDnsResult(
					hostname,
					urlValidation.errors[0] || "Skipped due to invalid URL",
				);

	const passedSsrfGate = urlValidation.isValid && dnsCheck.isValid;

	// ================================================================
	// PHASE 2: Active Network & Threat Intelligence Inspection
	// Only open outbound TLS/HTTP connections if Phase 1 passed the SSRF gate
	// ================================================================
	const timeoutMs = options.timeout ?? 8000;

	const [sslCheck, redirectCheck, initialPhishingCheck, initialMalwareCheck] =
		await Promise.all([
			options.skipSsl
				? createSkippedSslResult(url)
				: passedSsrfGate
					? checkSsl(url, timeoutMs)
					: createBlockedSslResult(url),
			options.skipRedirects
				? createSkippedRedirectResult(url)
				: passedSsrfGate
					? checkRedirects(url, { timeout: Math.min(timeoutMs, 5000) })
					: createBlockedRedirectResult(url),
			options.skipPhishing
				? createSkippedPhishingResult(url)
				: detectPhishing(url),
			options.skipMalware
				? createSkippedMalwareResult(url)
				: passedSsrfGate
					? checkMalware(url)
					: createBlockedMalwareResult(url),
		]);

	// ================================================================
	// PHASE 3: Re-inspect final redirect destination if URL redirected
	// Prevents redirect laundering (clean URL -> phishing/malware landing page)
	// ================================================================
	let phishingCheck = initialPhishingCheck;
	let malwareCheck = initialMalwareCheck;
	const finalUrl = redirectCheck.finalUrl;

	if (
		passedSsrfGate &&
		redirectCheck.isValid &&
		redirectCheck.hopCount > 0 &&
		finalUrl &&
		finalUrl !== url
	) {
		const [finalPhishing, finalMalware] = await Promise.all([
			options.skipPhishing ? null : detectPhishing(finalUrl),
			options.skipMalware ? null : checkMalware(finalUrl),
		]);

		if (finalPhishing && finalPhishing.suspicionScore > phishingCheck.suspicionScore) {
			phishingCheck = new PhishingCheckResult({
				isPhishing: phishingCheck.isPhishing || finalPhishing.isPhishing,
				suspicionScore: Math.max(
					phishingCheck.suspicionScore,
					finalPhishing.suspicionScore,
				),
				url: finalUrl,
				domain: finalPhishing.domain,
				reasons: Array.from(
					new Set([
						...phishingCheck.reasons,
						...finalPhishing.reasons.map((r) => `Final redirect target: ${r}`),
					]),
				),
				warnings: Array.from(
					new Set([...phishingCheck.warnings, ...finalPhishing.warnings]),
				),
			});
		}

		if (finalMalware && (!finalMalware.isSafe || finalMalware.threats.length > 0)) {
			malwareCheck = new MalwareCheckResult({
				isSafe: malwareCheck.isSafe && finalMalware.isSafe,
				url: finalUrl,
				threats: [...malwareCheck.threats, ...finalMalware.threats],
				checkedBy: Array.from(
					new Set([...malwareCheck.checkedBy, ...finalMalware.checkedBy]),
				),
				errors: [...malwareCheck.errors, ...finalMalware.errors],
				warnings: Array.from(
					new Set([...malwareCheck.warnings, ...finalMalware.warnings]),
				),
				checkTime: malwareCheck.checkTime + finalMalware.checkTime,
			});
		}
	}

	// Check suspicious executable/script patterns on both initial and final URL
	const patternCheckInitial = checkSuspiciousPatterns(url);
	const patternCheckFinal =
		finalUrl && finalUrl !== url
			? checkSuspiciousPatterns(finalUrl)
			: { suspicious: false, patterns: [] as string[] };
	const suspiciousPatterns = Array.from(
		new Set([
			...patternCheckInitial.patterns,
			...patternCheckFinal.patterns.map((p) => `Final redirect target: ${p}`),
		]),
	);

	const requireSafeBrowsing =
		process.env.SECURITY_REQUIRE_SAFE_BROWSING === "true";
	const hasConfirmedMalwareThreat = malwareCheck.threats.length > 0;
	const hasExternalMalwareFeedError =
		!hasConfirmedMalwareThreat && malwareCheck.errors.length > 0;
	const malwareHardFailed =
		hasConfirmedMalwareThreat ||
		(requireSafeBrowsing && hasExternalMalwareFeedError);

	// Collect all errors and warnings
	const allErrors = [
		...urlValidation.errors,
		...dnsCheck.errors,
		...sslCheck.errors,
		...redirectCheck.errors,
		...(malwareHardFailed ? malwareCheck.errors : []),
	];

	const allWarnings = [
		...urlValidation.warnings,
		...dnsCheck.warnings,
		...sslCheck.warnings,
		...redirectCheck.warnings,
		...phishingCheck.warnings,
		...malwareCheck.warnings,
		...(!malwareHardFailed && hasExternalMalwareFeedError
			? malwareCheck.errors.map(
					(err) => `External threat feed unavailable (${err})`,
				)
			: []),
	];

	// Identify critical issues
	const criticalIssues: string[] = [];

	if (!urlValidation.isValid) {
		criticalIssues.push(
			urlValidation.errors[0] === "Invalid URL format"
				? "URL format is invalid"
				: `URL security check failed: ${urlValidation.errors.join("; ")}`,
		);
	}

	if (!dnsCheck.isValid && urlValidation.isValid) {
		criticalIssues.push(
			`Domain DNS security check failed: ${dnsCheck.errors.join("; ")}`,
		);
	}

	if (!sslCheck.isValid && passedSsrfGate) {
		criticalIssues.push(
			`SSL/TLS validation failed: ${sslCheck.errors.join("; ")}`,
		);
	}

	if (!redirectCheck.isValid && passedSsrfGate) {
		criticalIssues.push(
			`Redirect chain blocked: ${redirectCheck.errors.join("; ")}`,
		);
	}

	if (phishingCheck.isPhishing) {
		criticalIssues.push(
			`Potential phishing detected (${phishingCheck.suspicionScore}% confidence)`,
		);
	}

	if (hasConfirmedMalwareThreat) {
		for (const threat of malwareCheck.threats) {
			criticalIssues.push(`${threat.threatType}: ${threat.description}`);
		}
	} else if (malwareHardFailed) {
		criticalIssues.push(
			`Malware verification failed: ${malwareCheck.errors.join("; ")}`,
		);
	}

	if (suspiciousPatterns.length > 0) {
		criticalIssues.push(...suspiciousPatterns);
	}

	// Calculate strict overall risk score (hard security failures always escalate to critical >= 80)
	const riskScore = calculateRiskScore({
		urlValidation,
		dnsCheck,
		sslCheck,
		redirectCheck,
		phishingCheck,
		malwareCheck,
		malwareHardFailed,
		hasExternalMalwareFeedError,
		suspiciousPatterns,
	});

	const overallRisk = getRiskLevel(riskScore);

	// Generate recommendations
	const recommendations = generateRecommendations({
		urlValidation,
		dnsCheck,
		sslCheck,
		redirectCheck,
		phishingCheck,
		malwareCheck,
	});

	// Strict verification gate: zero errors, zero critical issues, and risk below medium/high threshold
	const isVerified =
		allErrors.length === 0 && criticalIssues.length === 0 && riskScore < 40;

	const result = new LinkVerificationResult({
		url,
		isVerified,
		overallRisk,
		riskScore,
		checks: {
			urlValidation,
			dnsCheck,
			sslCheck,
			redirectCheck,
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

	// Cache the result under option-scoped key
	verificationCache.set(cacheKey, result);

	return result;
}

/**
 * Calculate overall risk score (0-100) with strict hard-fail floors for critical threats
 */
function calculateRiskScore(checks: {
	urlValidation: UrlValidationResult;
	dnsCheck: DnsCheckResult;
	sslCheck: SslCheckResult;
	redirectCheck: RedirectCheckResult;
	phishingCheck: PhishingCheckResult;
	malwareCheck: MalwareCheckResult;
	malwareHardFailed: boolean;
	hasExternalMalwareFeedError: boolean;
	suspiciousPatterns: string[];
}): number {
	let score = 0;

	// Additive risk components
	if (!checks.urlValidation.isValid) score += 35;
	if (!checks.dnsCheck.isValid) score += 30;
	if (!checks.sslCheck.isValid) score += 25;
	if (!checks.redirectCheck.isValid) score += 30;
	score += (checks.phishingCheck.suspicionScore / 100) * 40;
	if (checks.malwareHardFailed) {
		score += 45;
	} else if (checks.hasExternalMalwareFeedError) {
		score += 10;
	}
	if (checks.suspiciousPatterns.length > 0) score += 35;

	// Warning penalties (2 points per warning, max 16)
	const totalWarnings =
		checks.urlValidation.warnings.length +
		checks.dnsCheck.warnings.length +
		checks.sslCheck.warnings.length +
		checks.redirectCheck.warnings.length +
		checks.phishingCheck.warnings.length +
		checks.malwareCheck.warnings.length;
	score += Math.min(totalWarnings * 2, 16);

	// Hard-block floor: any confirmed critical threat MUST score >= 85 (critical)
	const hasHardViolation =
		!checks.urlValidation.isValid ||
		!checks.dnsCheck.isValid ||
		!checks.sslCheck.isValid ||
		!checks.redirectCheck.isValid ||
		checks.phishingCheck.isPhishing ||
		checks.malwareHardFailed ||
		checks.suspiciousPatterns.some(
			(p) =>
				p.includes("executable extension") ||
				p.includes("double extension") ||
				p.includes("script URI") ||
				p.includes("null-byte"),
		);

	if (hasHardViolation) {
		score = Math.max(score, 85);
	}

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
	redirectCheck: RedirectCheckResult;
	phishingCheck: PhishingCheckResult;
	malwareCheck: MalwareCheckResult;
}): string[] {
	const recommendations: string[] = [];

	if (checks.urlValidation.protocol === "http") {
		recommendations.push("Upgrade to HTTPS for better security");
	}

	if (!checks.dnsCheck.hasMxRecord && checks.dnsCheck.hasARecord) {
		recommendations.push(
			"Domain has no email records - may be newly registered",
		);
	}

	if (
		checks.sslCheck.daysUntilExpiration !== undefined &&
		checks.sslCheck.daysUntilExpiration < 30
	) {
		recommendations.push(
			"SSL certificate expiring soon - verify site legitimacy",
		);
	}

	if (checks.redirectCheck.hopCount > 0) {
		recommendations.push(
			`Destination redirects ${checks.redirectCheck.hopCount} time(s) to ${checks.redirectCheck.finalUrl} - prefer linking directly`,
		);
	}

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

	if (checks.malwareCheck.threats.length > 0) {
		recommendations.push(
			"DO NOT SHARE - URL flagged as malicious by security providers",
		);
	}

	if (recommendations.length === 0) {
		recommendations.push("URL passed all security checks - safe to share");
	}

	return recommendations;
}

/**
 * Helper functions to create skipped / SSRF-blocked check results
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

function createBlockedDnsResult(hostname: string, reason: string): DnsCheckResult {
	return new DnsCheckResult({
		isValid: false,
		hostname,
		hasARecord: false,
		hasAAAARecord: false,
		hasMxRecord: false,
		hasCnameRecord: false,
		aRecords: [],
		aaaaRecords: [],
		mxRecords: [],
		cnameRecords: [],
		errors: [reason],
		warnings: [],
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

function createBlockedSslResult(url: string): SslCheckResult {
	return new SslCheckResult({
		isValid: false,
		url,
		hasValidCertificate: false,
		errors: ["SSL check aborted by SSRF/DNS security gate"],
		warnings: [],
		checkTime: 0,
	});
}

function createSkippedRedirectResult(url: string): RedirectCheckResult {
	return new RedirectCheckResult({
		isValid: true,
		initialUrl: url,
		finalUrl: url,
		hopCount: 0,
		chain: [url],
		downgradedToHttp: false,
		errors: [],
		warnings: ["Redirect check skipped"],
		checkTime: 0,
	});
}

function createBlockedRedirectResult(url: string): RedirectCheckResult {
	return new RedirectCheckResult({
		isValid: false,
		initialUrl: url,
		finalUrl: url,
		hopCount: 0,
		chain: [url],
		downgradedToHttp: false,
		errors: ["Redirect check aborted by SSRF/DNS security gate"],
		warnings: [],
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

function createBlockedMalwareResult(url: string): MalwareCheckResult {
	return new MalwareCheckResult({
		isSafe: true,
		url,
		threats: [],
		checkedBy: [],
		errors: [],
		warnings: ["External malware check aborted by SSRF/DNS security gate"],
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
