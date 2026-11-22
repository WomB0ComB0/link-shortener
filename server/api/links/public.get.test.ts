import { describe, expect, it, vi } from "vitest";

const { executeQuery, getQuery } = vi.hoisted(() => ({
	executeQuery: vi.fn(),
	getQuery: vi.fn(),
}));

vi.mock("h3", () => ({
	defineEventHandler: (handler: unknown) => handler,
	getQuery,
}));
vi.mock("../../../server/utils/graphql", () => ({ executeQuery }));

import publicLinksHandler from "./public.get";

describe("public links endpoint", () => {
	it("maps GraphQL links to the public API shape", async () => {
		getQuery.mockReturnValue({ limit: "5" });
		executeQuery.mockResolvedValueOnce({
			data: {
				short_links: [
					{
						id: "id-1",
						short_url: "abc123",
						original_url: "https://example.com",
						custom_alias: null,
						created_at: "2026-01-01T00:00:00.000Z",
						clicks_aggregate: { aggregate: { count: 3 } },
					},
				],
			},
			error: null,
		});

		await expect(publicLinksHandler({} as never)).resolves.toEqual([
			{
				id: "id-1",
				shortUrl: "abc123",
				originalUrl: "https://example.com",
				customAlias: null,
				createdAt: "2026-01-01T00:00:00.000Z",
				totalClicks: 3,
			},
		]);
	});

	it("returns an empty list when GraphQL fails", async () => {
		getQuery.mockReturnValue({});
		executeQuery.mockResolvedValueOnce({ data: null, error: "down" });

		await expect(publicLinksHandler({} as never)).resolves.toEqual([]);
	});

	it("falls back to flat link and click queries when clicks_aggregate is not tracked", async () => {
		getQuery.mockReturnValue({ limit: "5" });
		executeQuery
			.mockResolvedValueOnce({
				data: null,
				error: new Error("field 'clicks_aggregate' not found in type: 'short_links'"),
			})
			.mockResolvedValueOnce({
				data: {
					short_links: [
						{
							id: "id-2",
							short_url: "proj",
							original_url: "https://mikeodnis.dev",
							custom_alias: "proj",
							created_at: "2026-01-01T00:00:00.000Z",
						},
					],
				},
				error: null,
			})
			.mockResolvedValueOnce({
				data: { clicks: [{ short_link_id: "id-2" }, { short_link_id: "id-2" }] },
				error: null,
			});

		await expect(publicLinksHandler({} as never)).resolves.toEqual([
			{
				id: "id-2",
				shortUrl: "proj",
				originalUrl: "https://mikeodnis.dev",
				customAlias: "proj",
				createdAt: "2026-01-01T00:00:00.000Z",
				totalClicks: 2,
			},
		]);
	});

	it("clamps query limit to [1, 50] and defaults negative or NaN values to 12", async () => {
		executeQuery.mockResolvedValue({ data: { short_links: [] }, error: null });

		getQuery.mockReturnValueOnce({ limit: "999999" });
		await publicLinksHandler({} as never);
		expect(executeQuery).toHaveBeenLastCalledWith(expect.any(String), {
			limit: 50,
		});

		getQuery.mockReturnValueOnce({ limit: "-10" });
		await publicLinksHandler({} as never);
		expect(executeQuery).toHaveBeenLastCalledWith(expect.any(String), {
			limit: 12,
		});
	});
});
