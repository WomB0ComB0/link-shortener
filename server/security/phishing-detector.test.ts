import { describe, expect, it } from "vitest";
import { detectPhishing } from "./phishing-detector";

describe("phishing detection", () => {
	it("does not flag a normal domain", async () => {
		const result = await detectPhishing("https://example.com");

		expect(result.isPhishing).toBe(false);
		expect(result.suspicionScore).toBe(0);
		expect(result.reasons).toEqual([]);
	});

	it("flags brand impersonation and credential-injection patterns", async () => {
		const result = await detectPhishing(
			"https://paypal.verify-account-login.example.tk/user@example.com",
		);

		expect(result.isPhishing).toBe(true);
		expect(result.suspicionScore).toBeGreaterThanOrEqual(50);
		expect(result.reasons).toEqual(
			expect.arrayContaining([
				expect.stringContaining("phishing keywords"),
				expect.stringContaining("@ symbol"),
				expect.stringContaining("suspicious TLD"),
			]),
		);
	});

	it("detects leetspeak brand typosquatting and punycode homographs", async () => {
		const leetResult = await detectPhishing("https://paypa1.com/login");
		expect(leetResult.isPhishing).toBe(true);
		expect(leetResult.reasons).toEqual(
			expect.arrayContaining([expect.stringContaining("paypal")]),
		);

		const punycodeResult = await detectPhishing(
			"https://xn--pypal-4ve.com/verify-account",
		);
		expect(punycodeResult.isPhishing).toBe(true);
		expect(punycodeResult.reasons).toEqual(
			expect.arrayContaining([expect.stringContaining("punycode")]),
		);
	});

	it("returns a structured result for malformed URLs", async () => {
		const result = await detectPhishing("not a URL");

		expect(result.isPhishing).toBe(false);
		expect(result.domain).toBe("");
		expect(result.reasons).toEqual(["Invalid URL format"]);
	});
});
