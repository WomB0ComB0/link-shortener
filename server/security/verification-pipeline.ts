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
 * Link Verification Pipeline (Strict 9-Stage Security & OSINT Engine)
 * Three-phase SSRF-gated orchestrator inspired by lissy93/web-check:
 *   Phase 1 (SSRF Gate):
 *     1. URL validation (syntax, protocol, port, credentials, SSRF/IP, nested schemes)
 *     2. DNS resolution & private-IP / CNAME-cloaking rebinding check
 *   Phase 2 (Active Network, Threat Intel & Domain OSINT — parallel):
 *     3. SSL/TLS certificate & cipher suite inspection
 *     4. Multi-hop SSRF-safe redirect chain & downgrade inspection
 *     5. Phishing, homograph & brand-impersonation heuristics
 *     6. Malware scanning (Google Safe Browsing + executable payload patterns)
 *     7. Zero-key Threat Intel DNSBLs (Cloudflare Security 1.1.1.2, Quad9, optional URLhaus)
 *     8. Domain Intelligence (RDAP age & registry suspension, DNSSEC, CAA, SPF/DMARC)
 *   Phase 3 (Final Target Content & Redirect Re-Inspection):
 *     9. HTTP Security Headers (HSTS/CSP/XFO/XCTO/grade A+-F), drive-by Content-Type/
 *        Content-Disposition blocking, and bounded 16 KiB HTML meta-refresh/mixed-content
 *        cloaking inspection — plus phishing/malware/threat-intel re-scan on final targets.
 */

import { Schema as S } from "effect";
import NodeCache from "node-cache";
import { checkDns, DnsCheckResult } from "./dns-checker";
import {
	checkDomainIntel,
	clearDomainIntelCache,
	DomainIntelCheckResult,
} from "./domain-intel-checker";
import {
	checkHttpSecurity,
	HttpSecurityCheckResult,
} from "./http-security-checker";
import {
	checkMalware,
	checkSuspiciousPatterns,
	MalwareCheckResult,
} from "./malware-checker";
import { detectPhishing, PhishingCheckResult } from "./phishing-detector";
import { checkRedirects, RedirectCheckResult } from "./redirect-checker";
import { checkSsl, SslCheckResult } from "./ssl-checker";
import {
	checkThreatIntel,
	clearThreatIntelCache,
	ThreatIntelCheckResult,
} from "./threat-intel-checker";
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
	skipThreatIntel: S.optional(S.Boolean),
	skipDomainIntel: S.optional(S.Boolean),
	skipHttpSecurity: S.optional(S.Boolean),
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
	threatIntelCheck: S.instanceOf(ThreatIntelCheckResult),
	domainIntelCheck: S.instanceOf(DomainIntelCheckResult),
	httpSecurityCheck: S.instanceOf(HttpSecurityCheckResult),
}) {}

// Effect Schema for link verification result
export class LinkVerificationResult extends S.Class<LinkVerificationResult>(
	"LinkVerificationResult",
)({
	url: S.String,
	isVerified: S.Boolean,
	overallRisk: S.Literals(["safe", "low", "medium", "high", "critical"]),
	riskScore: S.Number, // 0-100
	checks: S.Struct({
		urlValidation: S.Any,
		dnsCheck: S.Any,
		sslCheck: S.Any,
		redirectCheck: S.Any,
		phishingCheck: S.Any,
		malwareCheck: S.Any,
		threatIntelCheck: S.Any,
		domainIntelCheck: S.Any,
		httpSecurityCheck: S.Any,
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
	// Include all skip flags in cache key so skipped checks can NEVER poison full verification results
	const flags = [
		options.skipDns ? "noDns" : "dns",
		options.skipSsl ? "noSsl" : "ssl",
		options.skipRedirects ? "noRedir" : "redir",
		options.skipPhishing ? "noPhish" : "phish",
		options.skipMalware ? "noMal" : "mal",
		options.skipThreatIntel ? "noThreat" : "threat",
		options.skipDomainIntel ? "noDom" : "dom",
		options.skipHttpSecurity ? "noHttp" : "http",
	].join("|");
	return `${flags}::${url}`;
}

/**
 * Comprehensive 9-stage strict link verification & OSINT pipeline
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
	const domainResolvedInDns =
		!options.skipDns && (dnsCheck.hasARecord || dnsCheck.hasAAAARecord);

	// ================================================================
	// PHASE 2: Active Network, Threat Intelligence & Domain OSINT Inspection
	// Only open outbound TLS/HTTP connections if Phase 1 passed the SSRF gate
	// ================================================================
	const timeoutMs = options.timeout ?? 8000;
	const osintTimeoutMs = Math.min(timeoutMs, 2500);

	const [
		sslCheck,
		redirectCheck,
		initialPhishingCheck,
		initialMalwareCheck,
		initialThreatIntelCheck,
		domainIntelCheck,
	] = await Promise.all([
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
		options.skipThreatIntel
			? createSkippedThreatIntelResult(url, hostname)
			: passedSsrfGate
				? checkThreatIntel(url, {
						timeoutMs: osintTimeoutMs,
						domainResolvedInDns,
						skipCache: options.skipCache,
					})
				: createBlockedThreatIntelResult(url, hostname),
		options.skipDomainIntel
			? createSkippedDomainIntelResult(hostname)
			: passedSsrfGate && hostname
				? checkDomainIntel(hostname, {
						timeoutMs: osintTimeoutMs,
						skipCache: options.skipCache,
					})
				: createBlockedDomainIntelResult(hostname),
	]);

	// ================================================================
	// PHASE 3: Final Destination HTTP Security, Content & Redirect Re-Inspection
	// Inspects the final resolved target for security headers, drive-by executable
	// payloads, HTML meta-refresh cloaking, and redirect-laundered phishing/malware.
	// ================================================================
	let phishingCheck = initialPhishingCheck;
	let malwareCheck = initialMalwareCheck;
	let threatIntelCheck = initialThreatIntelCheck;
	const finalUrl = redirectCheck.finalUrl;

	const httpSecurityCheck = options.skipHttpSecurity
		? createSkippedHttpSecurityResult(finalUrl || url)
		: passedSsrfGate && redirectCheck.isValid
			? await checkHttpSecurity(finalUrl || url, Math.min(timeoutMs, 4000))
			: createBlockedHttpSecurityResult(
					finalUrl || url,
					!passedSsrfGate
						? "HTTP security inspection aborted by SSRF/DNS security gate"
						: "HTTP security inspection aborted due to blocked redirect chain",
				);

	// Collect any distinct downstream targets (HTTP redirect finalUrl and/or HTML meta-refresh URL)
	const downstreamTargets: Array<{ targetUrl: string; label: string }> = [];
	if (
		passedSsrfGate &&
		redirectCheck.isValid &&
		redirectCheck.hopCount > 0 &&
		finalUrl &&
		finalUrl !== url
	) {
		downstreamTargets.push({
			targetUrl: finalUrl,
			label: "Final redirect target",
		});
	}
	if (
		passedSsrfGate &&
		httpSecurityCheck.isValid &&
		httpSecurityCheck.metaRefreshUrl &&
		httpSecurityCheck.metaRefreshUrl !== url &&
		httpSecurityCheck.metaRefreshUrl !== finalUrl
	) {
		downstreamTargets.push({
			targetUrl: httpSecurityCheck.metaRefreshUrl,
			label: "HTML meta-refresh target",
		});
	}

	for (const { targetUrl, label } of downstreamTargets) {
		const [targetPhishing, targetMalware, targetThreatIntel] = await Promise.all([
			options.skipPhishing ? null : detectPhishing(targetUrl),
			options.skipMalware ? null : checkMalware(targetUrl),
			options.skipThreatIntel
				? null
				: checkThreatIntel(targetUrl, {
						timeoutMs: osintTimeoutMs,
						domainResolvedInDns: true,
						skipCache: options.skipCache,
					}),
		]);

		if (
			targetPhishing &&
			targetPhishing.suspicionScore > phishingCheck.suspicionScore
		) {
			phishingCheck = new PhishingCheckResult({
				isPhishing: phishingCheck.isPhishing || targetPhishing.isPhishing,
				suspicionScore: Math.max(
					phishingCheck.suspicionScore,
					targetPhishing.suspicionScore,
				),
				url: targetUrl,
				domain: targetPhishing.domain,
				reasons: Array.from(
					new Set([
						...phishingCheck.reasons,
						...targetPhishing.reasons.map((r) => `${label}: ${r}`),
					]),
				),
				warnings: Array.from(
					new Set([...phishingCheck.warnings, ...targetPhishing.warnings]),
				),
			});
		}

		if (
			targetMalware &&
			(!targetMalware.isSafe || targetMalware.threats.length > 0)
		) {
			malwareCheck = new MalwareCheckResult({
				isSafe: malwareCheck.isSafe && targetMalware.isSafe,
				url: targetUrl,
				threats: [...malwareCheck.threats, ...targetMalware.threats],
				checkedBy: Array.from(
					new Set([...malwareCheck.checkedBy, ...targetMalware.checkedBy]),
				),
				errors: [...malwareCheck.errors, ...targetMalware.errors],
				warnings: Array.from(
					new Set([...malwareCheck.warnings, ...targetMalware.warnings]),
				),
				checkTime: malwareCheck.checkTime + targetMalware.checkTime,
			});
		}

		if (targetThreatIntel && !targetThreatIntel.isSafe) {
			threatIntelCheck = new ThreatIntelCheckResult({
				isSafe: false,
				url: targetUrl,
				hostname: targetThreatIntel.hostname,
				checkedProviders: Array.from(
					new Set([
						...threatIntelCheck.checkedProviders,
						...targetThreatIntel.checkedProviders,
					]),
				),
				blockedBy: [
					...threatIntelCheck.blockedBy,
					...targetThreatIntel.blockedBy.map((hit) => ({
						...hit,
						reason: `${label}: ${hit.reason}`,
					})),
				],
				errors: [
					...threatIntelCheck.errors,
					...targetThreatIntel.errors.map((e) => `${label}: ${e}`),
				],
				warnings: Array.from(
					new Set([
						...threatIntelCheck.warnings,
						...targetThreatIntel.warnings,
					]),
				),
				checkTime: threatIntelCheck.checkTime + targetThreatIntel.checkTime,
			});
		}
	}

	// Check suspicious executable/script patterns on initial URL and all downstream targets
	const patternCheckInitial = checkSuspiciousPatterns(url);
	const downstreamPatternHits: string[] = [];
	for (const { targetUrl, label } of downstreamTargets) {
		const check = checkSuspiciousPatterns(targetUrl);
		for (const p of check.patterns) {
			downstreamPatternHits.push(`${label}: ${p}`);
		}
	}
	const suspiciousPatterns = Array.from(
		new Set([...patternCheckInitial.patterns, ...downstreamPatternHits]),
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
		...threatIntelCheck.errors,
		...domainIntelCheck.errors,
		...httpSecurityCheck.errors,
	];

	const allWarnings = [
		...urlValidation.warnings,
		...dnsCheck.warnings,
		...sslCheck.warnings,
		...redirectCheck.warnings,
		...phishingCheck.warnings,
		...malwareCheck.warnings,
		...threatIntelCheck.warnings,
		...domainIntelCheck.warnings,
		...httpSecurityCheck.warnings,
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

	if (!threatIntelCheck.isSafe) {
		for (const hit of threatIntelCheck.blockedBy) {
			criticalIssues.push(`${hit.provider}: ${hit.reason}`);
		}
	}

	if (!domainIntelCheck.isValid && passedSsrfGate) {
		criticalIssues.push(
			`Domain intelligence check failed: ${domainIntelCheck.errors.join("; ")}`,
		);
	}

	if (!httpSecurityCheck.isValid && passedSsrfGate && redirectCheck.isValid) {
		criticalIssues.push(
			`HTTP content security check failed: ${httpSecurityCheck.errors.join("; ")}`,
		);
	}

	if (suspiciousPatterns.length > 0) {
		criticalIssues.push(...suspiciousPatterns);
	}

	// Calculate strict overall risk score (hard security failures always escalate to critical >= 85)
	const riskScore = calculateRiskScore({
		urlValidation,
		dnsCheck,
		sslCheck,
		redirectCheck,
		phishingCheck,
		malwareCheck,
		threatIntelCheck,
		domainIntelCheck,
		httpSecurityCheck,
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
		threatIntelCheck,
		domainIntelCheck,
		httpSecurityCheck,
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
			threatIntelCheck,
			domainIntelCheck,
			httpSecurityCheck,
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
	threatIntelCheck: ThreatIntelCheckResult;
	domainIntelCheck: DomainIntelCheckResult;
	httpSecurityCheck: HttpSecurityCheckResult;
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
	if (!checks.threatIntelCheck.isSafe) score += 45;
	if (!checks.domainIntelCheck.isValid) score += 35;
	if (!checks.httpSecurityCheck.isValid) score += 40;
	if (checks.suspiciousPatterns.length > 0) score += 35;

	// Soft OSINT & HTTP content risk adjustments (inform risk without falsely blocking normal sites)
	if (checks.domainIntelCheck.domainAgeDays !== null) {
		if (checks.domainIntelCheck.domainAgeDays < 7) {
			score += 15;
		} else if (checks.domainIntelCheck.domainAgeDays < 30) {
			score += 8;
		}
	}
	if (checks.domainIntelCheck.isSuspended && checks.domainIntelCheck.isValid) {
		// clientHold (registrar hold)
		score += 15;
	}
	if (checks.httpSecurityCheck.hasInsecureFormAction) score += 10;
	if (checks.httpSecurityCheck.hasMixedContent) score += 5;

	// Warning penalties (2 points per warning, max 16)
	const totalWarnings =
		checks.urlValidation.warnings.length +
		checks.dnsCheck.warnings.length +
		checks.sslCheck.warnings.length +
		checks.redirectCheck.warnings.length +
		checks.phishingCheck.warnings.length +
		checks.malwareCheck.warnings.length +
		checks.threatIntelCheck.warnings.length +
		checks.domainIntelCheck.warnings.length +
		checks.httpSecurityCheck.warnings.length;
	score += Math.min(totalWarnings * 2, 16);

	// Hard-block floor: any confirmed critical threat MUST score >= 85 (critical)
	const hasHardViolation =
		!checks.urlValidation.isValid ||
		!checks.dnsCheck.isValid ||
		!checks.sslCheck.isValid ||
		!checks.redirectCheck.isValid ||
		checks.phishingCheck.isPhishing ||
		checks.malwareHardFailed ||
		!checks.threatIntelCheck.isSafe ||
		!checks.domainIntelCheck.isValid ||
		!checks.httpSecurityCheck.isValid ||
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
	threatIntelCheck: ThreatIntelCheckResult;
	domainIntelCheck: DomainIntelCheckResult;
	httpSecurityCheck: HttpSecurityCheckResult;
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
		checks.domainIntelCheck.domainAgeDays !== null &&
		checks.domainIntelCheck.domainAgeDays < 30
	) {
		recommendations.push(
			`Domain is only ${checks.domainIntelCheck.domainAgeDays} day(s) old - verify ownership before sharing`,
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

	if (checks.httpSecurityCheck.metaRefreshUrl) {
		recommendations.push(
			`Destination uses an HTML meta-refresh redirect to ${checks.httpSecurityCheck.metaRefreshUrl} - prefer linking directly`,
		);
	}

	if (checks.httpSecurityCheck.hasInsecureFormAction) {
		recommendations.push(
			"Destination page submits forms over insecure HTTP - avoid entering credentials",
		);
	}

	if (
		checks.httpSecurityCheck.securityGrade === "D" ||
		checks.httpSecurityCheck.securityGrade === "F"
	) {
		recommendations.push(
			`Destination HTTP security headers scored ${checks.httpSecurityCheck.securityGrade} (${checks.httpSecurityCheck.headerScore}/100) - missing HSTS/CSP/clickjacking headers`,
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

	if (
		checks.malwareCheck.threats.length > 0 ||
		!checks.threatIntelCheck.isSafe
	) {
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

function createSkippedThreatIntelResult(
	url: string,
	hostname: string,
): ThreatIntelCheckResult {
	return new ThreatIntelCheckResult({
		isSafe: true,
		url,
		hostname,
		checkedProviders: [],
		blockedBy: [],
		errors: [],
		warnings: ["Threat intelligence check skipped"],
		checkTime: 0,
	});
}

function createBlockedThreatIntelResult(
	url: string,
	hostname: string,
): ThreatIntelCheckResult {
	return new ThreatIntelCheckResult({
		isSafe: true,
		url,
		hostname,
		checkedProviders: [],
		blockedBy: [],
		errors: [],
		warnings: [
			"Threat intelligence check aborted by SSRF/DNS security gate",
		],
		checkTime: 0,
	});
}

function createSkippedDomainIntelResult(
	hostname: string,
): DomainIntelCheckResult {
	return new DomainIntelCheckResult({
		isValid: true,
		domain: hostname,
		registeredAt: null,
		domainAgeDays: null,
		registrar: null,
		statuses: [],
		isSuspended: false,
		isNewlyRegistered: false,
		dnssecEnabled: null,
		hasCaaRecord: false,
		caaIssuers: [],
		hasSpf: false,
		hasDmarc: false,
		dmarcPolicy: null,
		errors: [],
		warnings: ["Domain intelligence check skipped"],
		checkTime: 0,
	});
}

function createBlockedDomainIntelResult(
	hostname: string,
): DomainIntelCheckResult {
	return new DomainIntelCheckResult({
		isValid: true,
		domain: hostname,
		registeredAt: null,
		domainAgeDays: null,
		registrar: null,
		statuses: [],
		isSuspended: false,
		isNewlyRegistered: false,
		dnssecEnabled: null,
		hasCaaRecord: false,
		caaIssuers: [],
		hasSpf: false,
		hasDmarc: false,
		dmarcPolicy: null,
		errors: [],
		warnings: ["Domain intelligence check aborted by SSRF/DNS security gate"],
		checkTime: 0,
	});
}

function createSkippedHttpSecurityResult(url: string): HttpSecurityCheckResult {
	return new HttpSecurityCheckResult({
		isValid: true,
		url,
		statusCode: null,
		contentType: null,
		contentDispositionFilename: null,
		securityGrade: "N/A",
		headerScore: 0,
		headers: {
			strictTransportSecurity: false,
			hstsMaxAge: null,
			hstsIncludeSubDomains: false,
			hstsPreload: false,
			contentSecurityPolicy: false,
			xFrameOptions: false,
			xContentTypeOptions: false,
			referrerPolicy: false,
			permissionsPolicy: false,
			crossOriginOpenerPolicy: false,
		},
		metaRefreshUrl: null,
		hasMixedContent: false,
		hasInsecureFormAction: false,
		errors: [],
		warnings: ["HTTP security check skipped"],
		checkTime: 0,
	});
}

function createBlockedHttpSecurityResult(
	url: string,
	reason: string,
): HttpSecurityCheckResult {
	return new HttpSecurityCheckResult({
		isValid: false,
		url,
		statusCode: null,
		contentType: null,
		contentDispositionFilename: null,
		securityGrade: "N/A",
		headerScore: 0,
		headers: {
			strictTransportSecurity: false,
			hstsMaxAge: null,
			hstsIncludeSubDomains: false,
			hstsPreload: false,
			contentSecurityPolicy: false,
			xFrameOptions: false,
			xContentTypeOptions: false,
			referrerPolicy: false,
			permissionsPolicy: false,
			crossOriginOpenerPolicy: false,
		},
		metaRefreshUrl: null,
		hasMixedContent: false,
		hasInsecureFormAction: false,
		errors: [reason],
		warnings: [],
		checkTime: 0,
	});
}

/**
 * Clear verification cache (and sub-checker OSINT caches)
 */
export function clearVerificationCache() {
	verificationCache.flushAll();
	clearThreatIntelCache();
	clearDomainIntelCache();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
	return verificationCache.getStats();
}
