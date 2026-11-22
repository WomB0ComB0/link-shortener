import { describe, expect, it, vi } from "vitest";

const { executeQuery, getUserIdFromHeaders } = vi.hoisted(() => ({
	executeQuery: vi.fn(),
	getUserIdFromHeaders: vi.fn(),
}));

vi.mock("h3", () => ({
	defineEventHandler: (handler: unknown) => handler,
	createError: (input: Record<string, unknown>) =>
		Object.assign(new Error(String(input.message)), input),
}));
vi.mock("../../utils/graphql", () => ({ executeQuery }));
vi.mock("../../utils/auth", () => ({
	getUserIdFromHeaders,
	resolveAuthenticatedUserId: getUserIdFromHeaders,
}));

import myLinksHandler from "./me.get";

describe("user links endpoint", () => {
	it("requires authentication", async () => {
		getUserIdFromHeaders.mockResolvedValueOnce(null);

		await expect(myLinksHandler({} as never)).rejects.toMatchObject({
			statusCode: 401,
		});
	});

	it("maps links and click totals", async () => {
		getUserIdFromHeaders.mockResolvedValueOnce("user-id");
		executeQuery.mockResolvedValueOnce({
			data: {
				short_links: [
					{
						id: "link-id",
						short_url: "abc123",
						original_url: "https://example.com",
						custom_alias: "example",
						created_at: "2026-01-01T00:00:00.000Z",
						is_active: true,
						expires_at: null,
						clicks_aggregate: { aggregate: { count: 7 } },
					},
				],
			},
			error: null,
		});

		await expect(myLinksHandler({} as never)).resolves.toEqual([
			{
				id: "link-id",
				shortUrl: "abc123",
				originalUrl: "https://example.com",
				customAlias: "example",
				createdAt: "2026-01-01T00:00:00.000Z",
				isActive: true,
				expiresAt: null,
				totalClicks: 7,
			},
		]);
	});

	it("surfaces database failures", async () => {
		getUserIdFromHeaders.mockResolvedValueOnce("user-id");
		executeQuery.mockResolvedValueOnce({ data: null, error: new Error("down") });

		await expect(myLinksHandler({} as never)).rejects.toMatchObject({
			statusCode: 500,
		});
	});
});
