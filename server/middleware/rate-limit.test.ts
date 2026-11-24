import { describe, expect, it, vi } from "vitest";

const { check, getClientIP, getHeader, getUserIdFromHeaders } = vi.hoisted(
	() => ({
		check: vi.fn(),
		getClientIP: vi.fn(),
		getHeader: vi.fn(),
		getUserIdFromHeaders: vi.fn(),
	}),
);

vi.mock("../../lib/api-guard", () => ({
	apiGuard: { check },
	setApiGuardTelemetryListener: vi.fn(),
}));
vi.mock("../../lib/get-ip", () => ({ getClientIP }));
vi.mock("../utils/auth", () => ({ getUserIdFromHeaders }));
vi.mock("../../lib/rate-limit", async () => {
	const actual = await vi.importActual<typeof import("../../lib/rate-limit")>(
		"../../lib/rate-limit",
	);
	return {
		...actual,
		getRateLimitReset: (value: number) => `reset-${value}`,
	};
});
vi.mock("h3", () => ({
	defineEventHandler: (handler: unknown) => handler,
	getHeader,
	createError: (input: Record<string, unknown>) =>
		Object.assign(new Error(String(input.message)), input),
}));

import rateLimitMiddleware from "./rate-limit";

describe("rate-limit middleware", () => {
	it("skips non-API routes", async () => {
		await expect(
			rateLimitMiddleware({ path: "/dashboard" } as never),
		).resolves.toBeUndefined();
		expect(getClientIP).not.toHaveBeenCalled();
	});

	it("rejects banned API clients with 403", async () => {
		getClientIP.mockReturnValue("203.0.113.1");
		getHeader.mockReturnValue(undefined);
		getUserIdFromHeaders.mockReturnValue(null);
		check.mockResolvedValueOnce({ kind: "ban" });
		const event = {
			path: "/api/links/create",
			node: { req: { method: "POST" }, res: { setHeader: vi.fn() } },
		};

		await expect(rateLimitMiddleware(event as never)).rejects.toMatchObject({
			statusCode: 403,
		});
	});

	it("sets IETF RateLimit-*, legacy X-RateLimit-*, and Retry-After headers on 429", async () => {
		getClientIP.mockReturnValue("203.0.113.2");
		getHeader.mockReturnValue(undefined);
		getUserIdFromHeaders.mockReturnValue(null);
		const reset = Date.now() + 15_000;
		check.mockResolvedValueOnce({
			kind: "limit",
			limit: 10,
			remaining: 0,
			reset,
			windowSeconds: 60,
			policy: "create",
		});
		const setHeader = vi.fn();
		const event = {
			path: "/api/links/create",
			node: { req: { method: "POST" }, res: { setHeader } },
		};

		await expect(rateLimitMiddleware(event as never)).rejects.toMatchObject({
			statusCode: 429,
		});
		expect(setHeader).toHaveBeenCalledWith("RateLimit-Limit", "10");
		expect(setHeader).toHaveBeenCalledWith("RateLimit-Remaining", "0");
		expect(setHeader).toHaveBeenCalledWith("RateLimit-Policy", "10;w=60");
		expect(setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", "10");
		expect(setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", "0");
		expect(setHeader).toHaveBeenCalledWith("X-RateLimit-Reset", String(reset));
		expect(setHeader).toHaveBeenCalledWith("Retry-After", expect.any(String));
	});

	it("hashes sk_ API keys into identityKey without leaking raw tokens and sets headers on allow", async () => {
		getClientIP.mockReturnValue("203.0.113.3");
		getHeader.mockReturnValue("Bearer sk_live_super_secret_token_123456");
		getUserIdFromHeaders.mockReturnValue(null);
		const reset = Date.now() + 45_000;
		check.mockResolvedValueOnce({
			kind: "allow",
			rateLimit: {
				limit: 30,
				remaining: 29,
				reset,
				windowSeconds: 60,
				policy: "api",
			},
		});
		const setHeader = vi.fn();
		const event = {
			path: "/api/links/public?limit=6",
			node: { req: { method: "GET" }, res: { setHeader } },
		};

		await expect(rateLimitMiddleware(event as never)).resolves.toBeUndefined();
		expect(check).toHaveBeenCalledWith(
			expect.objectContaining({
				method: "GET",
				pathname: "/api/links/public",
				clientIp: "203.0.113.3",
				identityKey: expect.stringMatching(/^apikey:[0-9a-f]{16}$/),
			}),
		);
		expect(check.mock.calls.at(-1)?.[0]?.identityKey).not.toContain("sk_live_");
		expect(setHeader).toHaveBeenCalledWith("RateLimit-Limit", "30");
		expect(setHeader).toHaveBeenCalledWith("RateLimit-Remaining", "29");
		expect(setHeader).toHaveBeenCalledWith("RateLimit-Policy", "30;w=60");
		expect(setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", "30");
		expect(setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", "29");
	});
});
