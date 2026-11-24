import dns from "node:dns/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	checkThreatIntel,
	clearThreatIntelCache,
} from "./threat-intel-checker";

describe("zero-key threat intelligence & DNSBL checker", () => {
	const originalFetch = globalThis.fetch;
	const originalUrlhausKey = process.env.URLHAUS_AUTH_KEY;

	beforeEach(() => {
		clearThreatIntelCache();
		delete process.env.URLHAUS_AUTH_KEY;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		if (originalUrlhausKey) {
			process.env.URLHAUS_AUTH_KEY = originalUrlhausKey;
		} else {
			delete process.env.URLHAUS_AUTH_KEY;
		}
		vi.restoreAllMocks();
	});

	it("marks clean domains safe when Cloudflare Security and Quad9 return normal records", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					Status: 0,
					Answer: [{ name: "example.com.", type: 1, data: "93.184.216.34" }],
				}),
				{ status: 200 },
			),
		) as typeof fetch;

		vi.spyOn(dns.Resolver.prototype, "resolve4").mockResolvedValueOnce([
			"93.184.216.34",
		]);

		const result = await checkThreatIntel("https://example.com/docs", {
			skipCache: true,
		});

		expect(result.isSafe).toBe(true);
		expect(result.blockedBy).toHaveLength(0);
		expect(result.errors).toHaveLength(0);
		expect(result.checkedProviders).toEqual([
			"Cloudflare Security DNS",
			"Quad9 Threat Intelligence",
		]);
	});

	it("hard-blocks domains sinkholed (0.0.0.0 / EDE Blocked) by Cloudflare Security DNS", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					Status: 0,
					Answer: [{ name: "evil-phish.test.", type: 1, data: "0.0.0.0" }],
					Comment: ["EDE(16): Censored"],
				}),
				{ status: 200 },
			),
		) as typeof fetch;

		vi.spyOn(dns.Resolver.prototype, "resolve4").mockResolvedValueOnce([
			"1.2.3.4",
		]);

		const result = await checkThreatIntel("https://evil-phish.test/login", {
			skipCache: true,
		});

		expect(result.isSafe).toBe(false);
		expect(result.blockedBy).toHaveLength(1);
		expect(result.blockedBy[0]?.provider).toContain("Cloudflare Security DNS");
		expect(result.errors[0]).toContain("EDE(16): Censored");
	});

	it("hard-blocks domains flagged by Quad9 threat NXDOMAIN when Phase 1 DNS resolved", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					Status: 0,
					Answer: [{ name: "malware.test.", type: 1, data: "1.2.3.4" }],
				}),
				{ status: 200 },
			),
		) as typeof fetch;

		const nxError = Object.assign(new Error("queryA ENOTFOUND"), {
			code: "ENOTFOUND",
		});
		vi.spyOn(dns.Resolver.prototype, "resolve4").mockRejectedValue(nxError);

		const blocked = await checkThreatIntel("https://malware.test/", {
			domainResolvedInDns: true,
			skipCache: true,
		});
		expect(blocked.isSafe).toBe(false);
		expect(blocked.blockedBy[0]?.provider).toContain("Quad9");

		// Genuine NXDOMAIN (domain did not resolve in Phase 1) must NOT false-positive
		const notBlocked = await checkThreatIntel("https://malware.test/", {
			domainResolvedInDns: false,
			skipCache: true,
		});
		expect(notBlocked.isSafe).toBe(true);
	});

	it("queries Abuse.ch URLhaus when URLHAUS_AUTH_KEY is configured and blocks matches", async () => {
		process.env.URLHAUS_AUTH_KEY = "test-urlhaus-key";
		globalThis.fetch = vi.fn().mockImplementation(async (input: string) => {
			if (input.includes("urlhaus-api.abuse.ch")) {
				return new Response(
					JSON.stringify({
						query_status: "ok",
						url_status: "online",
						threat: "malware_download",
						tags: ["elf", "mirai"],
					}),
					{ status: 200 },
				);
			}
			return new Response(
				JSON.stringify({
					Status: 0,
					Answer: [{ name: "dropper.test.", type: 1, data: "1.2.3.4" }],
				}),
				{ status: 200 },
			);
		}) as typeof fetch;

		vi.spyOn(dns.Resolver.prototype, "resolve4").mockResolvedValueOnce([
			"1.2.3.4",
		]);

		const result = await checkThreatIntel("https://dropper.test/bin", {
			skipCache: true,
		});

		expect(result.isSafe).toBe(false);
		expect(result.checkedProviders).toContain("Abuse.ch URLhaus");
		expect(result.blockedBy[0]?.provider).toBe("Abuse.ch URLhaus");
		expect(result.blockedBy[0]?.reason).toContain("mirai");
	});

	it("degrades gracefully with warnings when DoH/DNS endpoints time out or fail", async () => {
		globalThis.fetch = vi
			.fn()
			.mockRejectedValue(new Error("network timeout")) as typeof fetch;
		vi.spyOn(dns.Resolver.prototype, "resolve4").mockRejectedValueOnce(
			Object.assign(new Error("timeout"), { code: "ETIMEOUT" }),
		);

		const result = await checkThreatIntel("https://resilient.example/", {
			skipCache: true,
		});

		expect(result.isSafe).toBe(true);
		expect(result.errors).toHaveLength(0);
		expect(result.warnings.length).toBe(2);
	});
});
