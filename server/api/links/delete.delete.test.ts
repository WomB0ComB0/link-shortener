import { beforeEach, describe, expect, it, vi } from "vitest";

const {
	getQuery,
	readBody,
	getUserIdFromHeaders,
	executeQuery,
	executeMutation,
	invalidateRedirectCache,
} = vi.hoisted(() => ({
	getQuery: vi.fn(),
	readBody: vi.fn(),
	getUserIdFromHeaders: vi.fn(),
	executeQuery: vi.fn(),
	executeMutation: vi.fn(),
	invalidateRedirectCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("h3", () => ({
	defineEventHandler: (handler: unknown) => handler,
	createError: (input: Record<string, unknown>) =>
		Object.assign(new Error(String(input.message)), input),
	getQuery,
	readBody,
}));
vi.mock("../../../server/utils/auth", () => ({ getUserIdFromHeaders }));
vi.mock("../../../server/utils/graphql", () => ({
	executeQuery,
	executeMutation,
}));
vi.mock("../../../server/cache/redirect-cache", () => ({
	invalidateRedirectCache,
}));

import deleteHandler from "./delete.delete";

const LINK_ID = "550e8400-e29b-41d4-a716-446655440020";

describe("DELETE /api/links/delete", () => {
	beforeEach(() => {
		getQuery.mockReset();
		readBody.mockReset();
		getUserIdFromHeaders.mockReset();
		executeQuery.mockReset();
		executeMutation.mockReset();
		invalidateRedirectCache.mockClear();
	});

	it("deletes an owner's link and invalidates cache keys", async () => {
		getQuery.mockReturnValueOnce({ id: LINK_ID });
		executeQuery.mockResolvedValueOnce({
			data: {
				short_links_by_pk: {
					id: LINK_ID,
					user_id: "owner-1",
					short_url: "del1234",
					custom_alias: "old-alias",
				},
			},
			error: null,
		});
		executeMutation.mockResolvedValueOnce({
			data: {
				delete_short_links_by_pk: {
					id: LINK_ID,
					short_url: "del1234",
					custom_alias: "old-alias",
				},
			},
			error: null,
		});

		const res = await deleteHandler({
			context: { user: { id: "owner-1" } },
		} as never);

		expect(res).toEqual({ deleted: true, id: LINK_ID, shortUrl: "del1234" });
		expect(invalidateRedirectCache).toHaveBeenCalledWith([
			"del1234",
			"old-alias",
		]);
	});

	it("forbids non-owners from deleting someone else's link", async () => {
		getQuery.mockReturnValueOnce({ id: LINK_ID });
		executeQuery.mockResolvedValueOnce({
			data: {
				short_links_by_pk: {
					id: LINK_ID,
					user_id: "owner-1",
					short_url: "del1234",
					custom_alias: null,
				},
			},
			error: null,
		});

		await expect(
			deleteHandler({ context: { user: { id: "attacker" } } } as never),
		).rejects.toMatchObject({ statusCode: 403 });
		expect(executeMutation).not.toHaveBeenCalled();
	});
});
