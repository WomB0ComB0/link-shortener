import { beforeEach, describe, expect, it } from "vitest";
import {
	clearVerificationCache,
	getCacheStats,
	verifyLink,
} from "./verification-pipeline";

const SKIP_ALL_NETWORK = {
	skipDns: true,
	skipSsl: true,
	skipRedirects: true,
	skipPhishing: true,
	skipMalware: true,
	skipThreatIntel: true,
	skipDomainIntel: true,
	skipHttpSecurity: true,
} as const;

describe("link verification pipeline (9-stage security & OSINT engine)", () => {
	beforeEach(() => {
		clearVerificationCache();
	});

	it("runs deterministic skipped checks across all 9 stages and produces a safe result", async () => {
		const result = await verifyLink("https://example.com", {
			...SKIP_ALL_NETWORK,
			skipCache: true,
		});

		expect(result.isVerified).toBe(true);
		expect(result.overallRisk).toBe("safe");
		expect(result.summary.totalErrors).toBe(0);
		expect(result.checks.dnsCheck.warnings).toContain("DNS check skipped");
		expect(result.checks.sslCheck.warnings).toContain("SSL check skipped");
		expect(result.checks.redirectCheck.warnings).toContain(
			"Redirect check skipped",
		);
		expect(result.checks.threatIntelCheck.warnings).toContain(
			"Threat intelligence check skipped",
		);
		expect(result.checks.domainIntelCheck.warnings).toContain(
			"Domain intelligence check skipped",
		);
		expect(result.checks.httpSecurityCheck.warnings).toContain(
			"HTTP security check skipped",
		);
	});

	it("escalates malformed and SSRF URLs to critical and aborts all active probes", async () => {
		const malformed = await verifyLink("not a URL", {
			...SKIP_ALL_NETWORK,
			skipCache: true,
		});

		expect(malformed.isVerified).toBe(false);
		expect(malformed.overallRisk).toBe("critical");
		expect(malformed.riskScore).toBeGreaterThanOrEqual(85);
		expect(malformed.summary.criticalIssues).toContain("URL format is invalid");

		const ssrf = await verifyLink("http://169.254.169.254/latest/meta-data/", {
			skipPhishing: true,
			skipMalware: true,
			skipCache: true,
		});
		expect(ssrf.isVerified).toBe(false);
		expect(ssrf.overallRisk).toBe("critical");
		expect(ssrf.checks.sslCheck.errors[0]).toMatch(/SSRF\/DNS security gate/);
		expect(ssrf.checks.redirectCheck.errors[0]).toMatch(
			/SSRF\/DNS security gate/,
		);
		expect(ssrf.checks.httpSecurityCheck.errors[0]).toMatch(
			/SSRF\/DNS security gate/,
		);
		expect(ssrf.checks.threatIntelCheck.warnings[0]).toMatch(
			/SSRF\/DNS security gate/,
		);
		expect(ssrf.checks.domainIntelCheck.warnings[0]).toMatch(
			/SSRF\/DNS security gate/,
		);
	});

	it("escalates executable payloads and phishing URLs to critical", async () => {
		const malwarePattern = await verifyLink(
			"https://example.com/invoice.pdf.exe",
			{
				...SKIP_ALL_NETWORK,
				skipPhishing: false,
				skipCache: true,
			},
		);
		expect(malwarePattern.isVerified).toBe(false);
		expect(malwarePattern.overallRisk).toBe("critical");
		expect(malwarePattern.riskScore).toBeGreaterThanOrEqual(85);
	});

	it("returns cached results for matching options without poisoning full checks", async () => {
		const first = await verifyLink("https://cache.example", SKIP_ALL_NETWORK);
		const second = await verifyLink("https://cache.example", SKIP_ALL_NETWORK);

		expect(first.metadata.cached).toBe(false);
		expect(second.metadata.cached).toBe(true);
		expect(getCacheStats().keys).toBe(1);
	});
});
