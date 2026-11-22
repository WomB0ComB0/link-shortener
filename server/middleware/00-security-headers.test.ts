import { beforeEach, describe, expect, it, vi } from "vitest";

const { setResponseHeader } = vi.hoisted(() => ({
	setResponseHeader: vi.fn(),
}));

vi.mock("h3", () => ({
	defineEventHandler: (handler: unknown) => handler,
	setResponseHeader,
}));

import securityHeadersMiddleware from "./00-security-headers";

describe("security headers middleware", () => {
	beforeEach(() => {
		setResponseHeader.mockReset();
	});

	it("sets baseline security headers on all responses", () => {
		securityHeadersMiddleware({ path: "/" } as never);

		expect(setResponseHeader).toHaveBeenCalledWith(
			expect.anything(),
			"X-Content-Type-Options",
			"nosniff",
		);
		expect(setResponseHeader).toHaveBeenCalledWith(
			expect.anything(),
			"X-Frame-Options",
			"DENY",
		);
		expect(setResponseHeader).toHaveBeenCalledWith(
			expect.anything(),
			"Content-Security-Policy",
			expect.stringContaining("frame-ancestors 'none'"),
		);
		expect(setResponseHeader).not.toHaveBeenCalledWith(
			expect.anything(),
			"Cache-Control",
			expect.anything(),
		);
	});

	it("disables caching on sensitive auth, key, and analytics endpoints", () => {
		securityHeadersMiddleware({ path: "/api/keys/list" } as never);

		expect(setResponseHeader).toHaveBeenCalledWith(
			expect.anything(),
			"Cache-Control",
			"no-store, max-age=0",
		);
		expect(setResponseHeader).toHaveBeenCalledWith(
			expect.anything(),
			"Pragma",
			"no-cache",
		);
	});
});
