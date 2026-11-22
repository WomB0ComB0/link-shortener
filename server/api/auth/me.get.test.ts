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
vi.mock("../../utils/auth", () => ({ getUserIdFromHeaders }));

import meHandler from "./me.get";

describe("current-user endpoint", () => {
	it("requires a valid session", async () => {
		getUserIdFromHeaders.mockReturnValueOnce(null);

		await expect(meHandler({} as never)).rejects.toMatchObject({
			statusCode: 401,
		});
	});

	it("returns a mapped user profile", async () => {
		getUserIdFromHeaders.mockReturnValueOnce("user-id");
		executeQuery.mockResolvedValueOnce({
			data: {
				users: [
					{
						id: "550e8400-e29b-41d4-a716-446655440000",
						email: "user@example.com",
						display_name: "User",
						photo_url: null,
						created_at: "2026-01-01T00:00:00.000Z",
					},
				],
			},
			error: null,
		});

		const result = await meHandler({} as never);

		expect(result).toMatchObject({
			id: "550e8400-e29b-41d4-a716-446655440000",
			email: "user@example.com",
			displayName: "User",
			photoUrl: null,
		});
	});

	it("returns not found when the user no longer exists", async () => {
		getUserIdFromHeaders.mockReturnValueOnce("missing-user");
		executeQuery.mockResolvedValueOnce({
			data: { users: [] },
			error: null,
		});

		await expect(meHandler({} as never)).rejects.toMatchObject({
			statusCode: 404,
		});
	});
});
