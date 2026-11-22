import { describe, expect, it, vi } from "vitest";

const { resolve4, resolve6, resolveCname, resolveMx } = vi.hoisted(() => ({
	resolve4: vi.fn(),
	resolve6: vi.fn(),
	resolveCname: vi.fn(),
	resolveMx: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({
	default: { resolve4, resolve6, resolveCname, resolveMx },
}));

import { checkDns, domainExists } from "./dns-checker";

describe("DNS checker", () => {
	it("reports valid records and suspicious private IPv4 addresses", async () => {
		resolve4.mockResolvedValueOnce(["192.168.1.10"]);
		resolve6.mockRejectedValueOnce({ code: "ENODATA" });
		resolveMx.mockResolvedValueOnce([
			{ exchange: "mail.example.com", priority: 10 },
		]);
		resolveCname.mockRejectedValueOnce({ code: "ENODATA" });

		const result = await checkDns("example.com");

		expect(result.hasARecord).toBe(true);
		expect(result.isValid).toBe(false);
		expect(result.errors).toContain(
			"Domain resolves to Private network IP address: 192.168.1.10",
		);
	});

	it("blocks 172.16/12, CGNAT, private IPv6 ULA, and internal CNAME cloaking", async () => {
		resolve4.mockResolvedValueOnce(["172.20.10.5", "100.64.1.2"]);
		resolve6.mockResolvedValueOnce(["fd00::1"]);
		resolveMx.mockRejectedValueOnce({ code: "ENODATA" });
		resolveCname.mockResolvedValueOnce(["db.internal"]);

		const result = await checkDns("rebind.example");

		expect(result.isValid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining("172.20.10.5"),
				expect.stringContaining("100.64.1.2"),
				expect.stringContaining("fd00::1"),
				expect.stringContaining("db.internal"),
			]),
		);
	});

	it("falls back to IPv6 for domain existence", async () => {
		resolve4.mockRejectedValueOnce(new Error("no A record"));
		resolve6.mockResolvedValueOnce(["2001:db8::1"]);

		await expect(domainExists("example.com")).resolves.toBe(true);
	});

	it("returns false when neither address family resolves", async () => {
		resolve4.mockRejectedValueOnce(new Error("no A record"));
		resolve6.mockRejectedValueOnce(new Error("no AAAA record"));

		await expect(domainExists("missing.example")).resolves.toBe(false);
	});
});
