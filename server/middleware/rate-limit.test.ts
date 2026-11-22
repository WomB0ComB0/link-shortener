import { describe, expect, it, vi } from "vitest";

const { check, getClientIP } = vi.hoisted(() => ({
	check: vi.fn(),
	getClientIP: vi.fn(),
}));

vi.mock("../../lib/api-guard", () => ({
	apiGuard: { check },
}));
vi.mock("../../lib/get-ip", () => ({ getClientIP }));
vi.mock("../../lib/rate-limit", () => ({
	getRateLimitReset: (value: number) => `reset-${value}`,
}));
vi.mock("h3", () => ({
	defineEventHandler: (handler: unknown) => handler,
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
		check.mockResolvedValueOnce({ kind: "ban" });
		const event = {
			path: "/api/links/create",
			node: { req: { method: "POST" }, res: { setHeader: vi.fn() } },
		};

		await expect(rateLimitMiddleware(event as never)).rejects.toMatchObject({
			statusCode: 403,
		});
	});

	it("sets rate-limit and Retry-After headers and rejects exhausted clients with 429", async () => {
		getClientIP.mockReturnValue("203.0.113.2");
		const reset = Date.now() + 15_000;
		check.mockResolvedValueOnce({
			kind: "limit",
			limit: 10,
			remaining: 0,
			reset,
		});
		const setHeader = vi.fn();
		const event = {
			path: "/api/links/create",
			node: { req: { method: "POST" }, res: { setHeader } },
		};

		await expect(rateLimitMiddleware(event as never)).rejects.toMatchObject({
			statusCode: 429,
		});
		expect(setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", "10");
		expect(setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", "0");
		expect(setHeader).toHaveBeenCalledWith("X-RateLimit-Reset", String(reset));
		expect(setHeader).toHaveBeenCalledWith("Retry-After", expect.any(String));
	});

	it("attaches rate-limit headers on allowed requests", async () => {
		getClientIP.mockReturnValue("203.0.113.3");
		check.mockResolvedValueOnce({
			kind: "allow",
			rateLimit: { limit: 30, remaining: 29, reset: 123456 },
		});
		const setHeader = vi.fn();
		const event = {
			path: "/api/links/public?limit=6",
			node: { req: { method: "GET" }, res: { setHeader } },
		};

		await expect(rateLimitMiddleware(event as never)).resolves.toBeUndefined();
		expect(check).toHaveBeenCalledWith({
			method: "GET",
			pathname: "/api/links/public",
			clientIp: "203.0.113.3",
		});
		expect(setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", "30");
		expect(setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", "29");
	});
});
