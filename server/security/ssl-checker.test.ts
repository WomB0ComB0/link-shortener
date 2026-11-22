import { describe, expect, it } from "vitest";
import { checkSsl } from "./ssl-checker";

describe("SSL checker", () => {
	it("warns when a URL uses HTTP", async () => {
		const result = await checkSsl("http://example.com");

		expect(result.isValid).toBe(true);
		expect(result.hasValidCertificate).toBe(false);
		expect(result.warnings).toContain(
			"URL uses HTTP instead of HTTPS - not encrypted",
		);
	});

	it("reports malformed HTTPS URLs without throwing", async () => {
		const result = await checkSsl("https://");

		expect(result.isValid).toBe(false);
		expect(result.hasValidCertificate).toBe(false);
		expect(result.errors[0]).toMatch(/SSL check failed/);
	});
});
