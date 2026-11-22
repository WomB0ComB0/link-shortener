import { describe, expect, it, vi } from "vitest";

const { executeQuery, getQuery, getUserIdFromHeaders } = vi.hoisted(() => ({
	executeQuery: vi.fn(),
	getQuery: vi.fn(),
	getUserIdFromHeaders: vi.fn(),
}));

vi.mock("h3", () => ({
	defineEventHandler: (handler: unknown) => handler,
	createError: (input: Record<string, unknown>) =>
		Object.assign(new Error(String(input.message)), input),
	getQuery,
}));
vi.mock("../../../server/utils/graphql", () => ({ executeQuery }));
vi.mock("../../../server/utils/auth", () => ({ getUserIdFromHeaders }));

import analyticsHandler from "./analytics.get";

describe("link analytics endpoint", () => {
	it("rejects malformed link IDs", async () => {
		getQuery.mockReturnValueOnce({ shortLinkId: "not-a-uuid" });

		await expect(analyticsHandler({} as never)).rejects.toMatchObject({
			statusCode: 400,
		});
	});

	it("blocks a different authenticated owner", async () => {
		getQuery.mockReturnValueOnce({
			shortLinkId: "550e8400-e29b-41d4-a716-446655440000",
		});
		getUserIdFromHeaders.mockReturnValueOnce("different-user");
		executeQuery.mockResolvedValueOnce({
			data: {
				short_links: [
					{
						id: "550e8400-e29b-41d4-a716-446655440000",
						user_id: "owner-user",
						clicks: [],
						clicks_aggregate: { aggregate: { count: 0 } },
					},
				],
			},
			error: null,
		});

		await expect(analyticsHandler({} as never)).rejects.toMatchObject({
			statusCode: 403,
		});
	});

	it("returns mapped analytics for a public link", async () => {
		getQuery.mockReturnValueOnce({
			shortLinkId: "550e8400-e29b-41d4-a716-446655440000",
		});
		getUserIdFromHeaders.mockReturnValueOnce(null);
		executeQuery.mockResolvedValueOnce({
			data: {
				short_links: [
					{
						id: "550e8400-e29b-41d4-a716-446655440000",
						user_id: null,
						short_url: "abc123",
						original_url: "https://example.com",
						custom_alias: null,
						created_at: "2026-01-01T00:00:00.000Z",
						is_active: true,
						expires_at: null,
						clicks: [],
						clicks_aggregate: { aggregate: { count: 2 } },
					},
				],
			},
			error: null,
		});

		const result = await analyticsHandler({} as never);

		expect(result).toMatchObject({
			id: "550e8400-e29b-41d4-a716-446655440000",
			shortUrl: "abc123",
			totalClicks: 2,
			clicks: [],
		});
	});

	it("serializes populated click events without Schema ParseError", async () => {
		getQuery.mockReturnValueOnce({
			shortLinkId: "550e8400-e29b-41d4-a716-446655440000",
		});
		getUserIdFromHeaders.mockReturnValueOnce(null);
		executeQuery.mockResolvedValueOnce({
			data: {
				short_links: [
					{
						id: "550e8400-e29b-41d4-a716-446655440000",
						user_id: null,
						short_url: "resume-tour",
						original_url: "https://mikeodnis.dev/resume",
						custom_alias: "resume-tour",
						created_at: "2026-11-22T00:00:00.000Z",
						is_active: true,
						expires_at: null,
						clicks: [
							{
								id: "660e8400-e29b-41d4-a716-446655440001",
								timestamp: "2026-11-22T20:05:52.703Z",
								user_agent: "Mozilla/5.0 Chrome/131.0",
								referrer: "https://www.linkedin.com/in/mikeodnis",
								ip_address: "::1",
								country: "United States",
								city: "New York",
							},
						],
						clicks_aggregate: { aggregate: { count: 1 } },
					},
				],
			},
			error: null,
		});

		const result = await analyticsHandler({} as never);

		expect(result).toMatchObject({
			id: "550e8400-e29b-41d4-a716-446655440000",
			shortUrl: "resume-tour",
			totalClicks: 1,
			clicks: [
				{
					id: "660e8400-e29b-41d4-a716-446655440001",
					referrer: "https://www.linkedin.com/in/mikeodnis",
					country: "United States",
					city: "New York",
				},
			],
		});
	});
});
