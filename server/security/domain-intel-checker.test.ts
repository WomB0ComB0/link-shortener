import dns from "node:dns/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	checkDomainIntel,
	clearDomainIntelCache,
	extractRegistrableDomain,
} from "./domain-intel-checker";

describe("domain intelligence checker (RDAP, DNSSEC, CAA, SPF/DMARC)", () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		clearDomainIntelCache();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it("extracts registrable apex domains including multi-part public suffixes", () => {
		expect(extractRegistrableDomain("docs.api.github.com")).toBe("github.com");
		expect(extractRegistrableDomain("sub.service.example.co.uk")).toBe(
			"example.co.uk",
		);
		expect(extractRegistrableDomain("mikeodnis.dev.")).toBe("mikeodnis.dev");
		expect(extractRegistrableDomain("8.8.8.8")).toBe("8.8.8.8");
	});

	it("parses established domains with RDAP age, DNSSEC, CAA, SPF, and DMARC cleanly", async () => {
		const fiveYearsAgo = new Date(
			Date.now() - 5 * 365 * 24 * 60 * 60 * 1000,
		).toISOString();

		globalThis.fetch = vi.fn().mockImplementation(async (input: string) => {
			if (input.includes("rdap.org")) {
				return new Response(
					JSON.stringify({
						status: ["client transfer prohibited"],
						events: [{ eventAction: "registration", eventDate: fiveYearsAgo }],
						entities: [
							{
								roles: ["registrar"],
								vcardArray: [
									"vcard",
									[["fn", {}, "text", "Cloudflare, Inc."]],
								],
							},
						],
					}),
					{ status: 200 },
				);
			}
			return new Response(JSON.stringify({ Status: 0, AD: true }), {
				status: 200,
			});
		}) as typeof fetch;

		vi.spyOn(dns, "resolveCaa").mockResolvedValueOnce([
			{ critical: 0, issue: "letsencrypt.org" },
		] as any);
		vi.spyOn(dns, "resolveTxt").mockImplementation(async (name: string) => {
			if (name.startsWith("_dmarc.")) {
				return [["v=DMARC1; p=reject; rua=mailto:dmarc@example.com"]];
			}
			return [["v=spf1 include:_spf.example.com ~all"]];
		});

		const result = await checkDomainIntel("sub.example.com", {
			skipCache: true,
		});

		expect(result.isValid).toBe(true);
		expect(result.domain).toBe("example.com");
		expect(result.registrar).toBe("Cloudflare, Inc.");
		expect(result.domainAgeDays).toBeGreaterThan(1800);
		expect(result.isNewlyRegistered).toBe(false);
		expect(result.isSuspended).toBe(false);
		expect(result.dnssecEnabled).toBe(true);
		expect(result.hasCaaRecord).toBe(true);
		expect(result.caaIssuers).toEqual(["letsencrypt.org"]);
		expect(result.hasSpf).toBe(true);
		expect(result.hasDmarc).toBe(true);
		expect(result.dmarcPolicy).toBe("reject");
		expect(result.errors).toHaveLength(0);
		expect(result.warnings).toHaveLength(0);
	});

	it("hard-fails domains with EPP serverHold registry suspension", async () => {
		globalThis.fetch = vi.fn().mockImplementation(async (input: string) => {
			if (input.includes("rdap.org")) {
				return new Response(
					JSON.stringify({
						status: ["server hold"],
						events: [
							{
								eventAction: "registration",
								eventDate: new Date(Date.now() - 2 * 86400_000).toISOString(),
							},
						],
					}),
					{ status: 200 },
				);
			}
			return new Response(JSON.stringify({ Status: 0, AD: false }), {
				status: 200,
			});
		}) as typeof fetch;

		vi.spyOn(dns, "resolveCaa").mockRejectedValueOnce(new Error("ENODATA"));
		vi.spyOn(dns, "resolveTxt").mockRejectedValue(new Error("ENODATA"));

		const result = await checkDomainIntel("suspended-phish.example", {
			skipCache: true,
		});

		expect(result.isValid).toBe(false);
		expect(result.isSuspended).toBe(true);
		expect(result.isNewlyRegistered).toBe(true);
		expect(result.errors[0]).toContain("serverHold");
		expect(result.warnings[0]).toContain("< 7 days");
	});

	it("warns on newly registered domains without hard-blocking when RDAP or DNS fails", async () => {
		globalThis.fetch = vi
			.fn()
			.mockRejectedValue(new Error("RDAP unavailable")) as typeof fetch;
		vi.spyOn(dns, "resolveCaa").mockRejectedValueOnce(new Error("ENODATA"));
		vi.spyOn(dns, "resolveTxt").mockRejectedValue(new Error("ENODATA"));

		const result = await checkDomainIntel("fallback.example", {
			skipCache: true,
		});

		expect(result.isValid).toBe(true);
		expect(result.domainAgeDays).toBeNull();
		expect(result.dnssecEnabled).toBeNull();
		expect(result.errors).toHaveLength(0);
	});
});
