import { describe, expect, it } from "vitest";
import { isValidUrlFormat, validateUrl } from "./url-validator";

describe("URL validation", () => {
	it("accepts normal HTTP and HTTPS URLs", async () => {
		const result = await validateUrl("https://example.com/path");

		expect(result.isValid).toBe(true);
		expect(result.protocol).toBe("https");
		expect(result.domain).toBe("example.com");
		expect(result.tld).toBe("com");
		expect(result.subdomain).toBeNull();
		expect(result.errors).toEqual([]);
	});

	it("rejects malformed, unsupported, and private/metadata URLs", async () => {
		expect((await validateUrl("not a URL")).isValid).toBe(false);
		expect((await validateUrl("ftp://example.com")).isValid).toBe(false);
		expect((await validateUrl("http://127.0.0.1/admin")).errors).toContain(
			"URLs pointing to localhost or private networks are not allowed",
		);
		expect(
			(await validateUrl("http://169.254.169.254/latest/meta-data/")).isValid,
		).toBe(false);
		expect((await validateUrl("http://[::1]/secret")).isValid).toBe(false);
		expect(
			(await validateUrl("http://[::ffff:127.0.0.1]/admin")).isValid,
		).toBe(false);
		expect(
			(await validateUrl("https://metadata.google.internal/computeMetadata/v1"))
				.isValid,
		).toBe(false);
	});

	it("rejects embedded credentials, non-standard ports, self-redirects, and nested script schemes", async () => {
		expect(
			(await validateUrl("https://user:pass@example.com/login")).errors,
		).toContain("URLs with embedded credentials are not allowed");
		expect(
			(await validateUrl("https://example.com:8443/internal")).errors[0],
		).toMatch(/Non-standard port/);
		expect(
			(await validateUrl("https://links.mikeodnis.dev/loop")).errors,
		).toContain("Self-referential shortener URLs are not allowed");
		expect(
			(await validateUrl("https://example.com/r?next=javascript:alert(1)"))
				.errors,
		).toContain("URL contains embedded dangerous URI scheme");
		expect(
			(await validateUrl(`https://example.com/${"a".repeat(2050)}`)).isValid,
		).toBe(false);
	});

	it("flags punycode IDN homographs and suspicious URL characteristics", async () => {
		const punycodeResult = await validateUrl("https://xn--pypal-4ve.com/login");
		expect(punycodeResult.warnings).toEqual(
			expect.arrayContaining([expect.stringContaining("punycode")]),
		);

		const result = await validateUrl(
			"http://login.verify.account.example.com/path?token=1",
		);

		expect(result.warnings).toEqual(
			expect.arrayContaining([
				"Consider using HTTPS for better security",
				expect.stringContaining("suspicious keywords"),
			]),
		);
		expect(result.subdomain).toBe("login.verify.account");
	});

	it("provides a fast HTTP/HTTPS format check", () => {
		expect(isValidUrlFormat("https://example.com")).toBe(true);
		expect(isValidUrlFormat("http://example.com")).toBe(true);
		expect(isValidUrlFormat("javascript:alert(1)")).toBe(false);
	});
});
