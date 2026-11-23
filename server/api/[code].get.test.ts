import { beforeEach, describe, expect, it, vi } from "vitest";

const {
	executeMutation,
	executeQuery,
	getHeader,
	getRouterParam,
	sendRedirect,
	setResponseHeader,
} = vi.hoisted(() => ({
	executeMutation: vi.fn(),
	executeQuery: vi.fn(),
	getHeader: vi.fn(),
	getRouterParam: vi.fn(),
	sendRedirect: vi.fn(),
	setResponseHeader: vi.fn(),
}));

vi.mock("h3", () => ({
	defineEventHandler: (handler: unknown) => handler,
	createError: (input: Record<string, unknown>) =>
		Object.assign(new Error(String(input.message)), input),
	getHeader,
	getRouterParam,
	sendRedirect,
	setResponseHeader,
}));
vi.mock("../utils/graphql", () => ({ executeMutation, executeQuery }));
vi.mock("../../lib/redis-guard", () => ({ getGuardRedis: () => null }));

import { clickBuffer } from "../analytics/click-buffer";
import { redirectCache } from "../cache/redirect-cache";
import { metrics } from "../observability/metrics";
import redirectHandler from "./[code].get";

describe("short-link redirect endpoint", () => {
	beforeEach(() => {
		executeMutation.mockReset();
		executeQuery.mockReset();
		getHeader.mockReset();
		getRouterParam.mockReset();
		sendRedirect.mockReset();
		setResponseHeader.mockReset();
		redirectCache.clearLocal();
		clickBuffer.clear();
		metrics.reset();
	});

	it("requires a short-link code", async () => {
		getRouterParam.mockReturnValueOnce(undefined);

		await expect(redirectHandler({} as never)).rejects.toMatchObject({
			statusCode: 400,
		});
	});

	it("rejects missing, disabled, and expired links with 404/410", async () => {
		getRouterParam.mockReturnValueOnce("missing");
		executeQuery.mockResolvedValueOnce({ data: { short_links: [] }, error: null });
		await expect(redirectHandler({} as never)).rejects.toMatchObject({
			statusCode: 404,
		});

		getRouterParam.mockReturnValueOnce("disabled");
		executeQuery.mockResolvedValueOnce({
			data: {
				short_links: [
					{
						id: "link-disabled",
						is_active: false,
						expires_at: null,
						original_url: "https://example.com",
					},
				],
			},
			error: null,
		});
		await expect(redirectHandler({} as never)).rejects.toMatchObject({
			statusCode: 410,
		});

		getRouterParam.mockReturnValueOnce("expired");
		executeQuery.mockResolvedValueOnce({
			data: {
				short_links: [
					{
						id: "link-expired",
						is_active: true,
						expires_at: "2020-01-01T00:00:00.000Z",
						original_url: "https://example.com",
					},
				],
			},
			error: null,
		});
		await expect(redirectHandler({} as never)).rejects.toMatchObject({
			statusCode: 410,
		});
	});

	it("returns controlled 503 when cache misses and database is unavailable", async () => {
		getRouterParam.mockReturnValueOnce("dbdown");
		executeQuery.mockResolvedValueOnce({
			data: null,
			error: new Error("connection refused"),
		});

		await expect(redirectHandler({} as never)).rejects.toMatchObject({
			statusCode: 503,
		});
		expect(metrics.status503).toBe(1);
	});

	it("blocks stored unsafe redirect targets at redirect time", async () => {
		getRouterParam.mockReturnValueOnce("badlink");
		executeQuery.mockResolvedValueOnce({
			data: {
				short_links: [
					{
						id: "link-bad",
						is_active: true,
						expires_at: null,
						original_url: "http://169.254.169.254/latest/meta-data/",
					},
				],
			},
			error: null,
		});

		await expect(redirectHandler({} as never)).rejects.toMatchObject({
			statusCode: 403,
		});
		expect(sendRedirect).not.toHaveBeenCalled();
	});

	it("caches active links, sets hardened 302 headers, and enqueues privacy-safe analytics", async () => {
		getRouterParam.mockReturnValueOnce("abc1234");
		getHeader.mockImplementation((_event: unknown, name: string) => {
			if (name === "user-agent") return "Mozilla/5.0 Chrome/130";
			if (name === "referer") return "https://referrer.example/path?token=secret";
			if (name === "x-vercel-ip-country") return "US";
			if (name === "x-vercel-ip-city") return "New York";
			return undefined;
		});
		executeQuery.mockResolvedValueOnce({
			data: {
				short_links: [
					{
						id: "link-id",
						short_url: "abc1234",
						custom_alias: null,
						is_active: true,
						expires_at: null,
						original_url: "https://example.com/target",
					},
				],
			},
			error: null,
		});
		executeMutation.mockResolvedValueOnce({ data: { insert_clicks: { affected_rows: 1 } }, error: null });
		sendRedirect.mockReturnValueOnce("redirected");

		await expect(redirectHandler({} as never)).resolves.toBe("redirected");
		expect(setResponseHeader).toHaveBeenCalledWith(
			{},
			"Cache-Control",
			"private, max-age=90",
		);
		expect(setResponseHeader).toHaveBeenCalledWith(
			{},
			"Referrer-Policy",
			"no-referrer",
		);
		expect(setResponseHeader).toHaveBeenCalledWith(
			{},
			"X-Robots-Tag",
			"noindex, nofollow",
		);
		expect(sendRedirect).toHaveBeenCalledWith(
			{},
			"https://example.com/target",
			302,
		);

		// Flush buffered analytics batch and verify privacy guarantees (no raw IP, stripped referrer query)
		const flushed = await clickBuffer.flush();
		expect(flushed).toBe(1);
		expect(executeMutation).toHaveBeenCalledWith(
			expect.any(String),
			{
				objects: [
					expect.objectContaining({
						short_link_id: "link-id",
						ip_address: null,
						referrer: "https://referrer.example/path",
						country: "US",
						city: "New York",
					}),
				],
			},
		);

		// Second request for the same code hits L1 cache without touching DB
		getRouterParam.mockReturnValueOnce("abc1234");
		sendRedirect.mockReturnValueOnce("redirected-cached");
		await expect(redirectHandler({} as never)).resolves.toBe("redirected-cached");
		expect(executeQuery).toHaveBeenCalledTimes(1);
		expect(metrics.l1Hits).toBe(1);
	});
});
