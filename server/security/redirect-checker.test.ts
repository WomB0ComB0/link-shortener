import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { httpRequest, httpsRequest } = vi.hoisted(() => ({
	httpRequest: vi.fn(),
	httpsRequest: vi.fn(),
}));

vi.mock("node:http", () => ({
	default: { request: httpRequest },
}));
vi.mock("node:https", () => ({
	default: { request: httpsRequest },
}));

import { checkRedirects } from "./redirect-checker";

function mockHop(statusCode: number, location?: string) {
	return (_opts: unknown, cb: (res: any) => void) => {
		const req = new EventEmitter() as any;
		req.destroy = vi.fn();
		req.end = vi.fn(() => {
			const res = {
				statusCode,
				headers: location ? { location } : {},
				resume: vi.fn(),
			};
			cb(res);
		});
		return req;
	};
}

describe("redirect chain security checker", () => {
	beforeEach(() => {
		httpRequest.mockReset();
		httpsRequest.mockReset();
	});

	it("accepts a clean non-redirecting URL", async () => {
		httpsRequest.mockImplementationOnce(mockHop(200));

		const result = await checkRedirects("https://example.com/page");

		expect(result.isValid).toBe(true);
		expect(result.hopCount).toBe(0);
		expect(result.finalUrl).toBe("https://example.com/page");
	});

	it("blocks HTTPS to HTTP protocol downgrade in redirects", async () => {
		httpsRequest.mockImplementationOnce(
			mockHop(302, "http://example.com/downgraded"),
		);

		const result = await checkRedirects("https://example.com/start");

		expect(result.isValid).toBe(false);
		expect(result.downgradedToHttp).toBe(true);
		expect(result.errors).toContain(
			"Redirect chain downgrades from HTTPS to insecure HTTP",
		);
	});

	it("blocks SSRF redirects targeting private or metadata IPs", async () => {
		httpsRequest.mockImplementationOnce(
			mockHop(302, "http://169.254.169.254/latest/meta-data/"),
		);

		const result = await checkRedirects("https://example.com/ssrf");

		expect(result.isValid).toBe(false);
		expect(result.errors[0]).toMatch(/Unsafe redirect target blocked/);
	});

	it("detects redirect loops", async () => {
		httpsRequest
			.mockImplementationOnce(mockHop(302, "https://example.com/b"))
			.mockImplementationOnce(mockHop(302, "https://example.com/a"));

		const result = await checkRedirects("https://example.com/a");

		expect(result.isValid).toBe(false);
		expect(result.errors).toContain("Redirect loop detected");
	});

	it("enforces maximum redirect hop cap", async () => {
		httpsRequest
			.mockImplementationOnce(mockHop(302, "https://example.com/2"))
			.mockImplementationOnce(mockHop(302, "https://example.com/3"))
			.mockImplementationOnce(mockHop(302, "https://example.com/4"));

		const result = await checkRedirects("https://example.com/1", { maxHops: 2 });

		expect(result.isValid).toBe(false);
		expect(result.errors[0]).toMatch(/exceeds maximum allowed hops/);
	});
});
