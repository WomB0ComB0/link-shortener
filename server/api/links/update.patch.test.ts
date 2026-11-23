import { beforeEach, describe, expect, it, vi } from "vitest";

const {
	readBody,
	getUserIdFromHeaders,
	executeQuery,
	executeMutation,
	verifyLink,
	invalidateRedirectCache,
} = vi.hoisted(() => ({
	readBody: vi.fn(),
	getUserIdFromHeaders: vi.fn(),
	executeQuery: vi.fn(),
	executeMutation: vi.fn(),
	verifyLink: vi.fn(),
	invalidateRedirectCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("h3", () => ({
	defineEventHandler: (handler: unknown) => handler,
	createError: (input: Record<string, unknown>) =>
		Object.assign(new Error(String(input.message)), input),
	readBody,
}));
vi.mock("../../../server/utils/auth", () => ({ getUserIdFromHeaders }));
vi.mock("../../../server/utils/graphql", () => ({
	executeQuery,
	executeMutation,
}));
vi.mock("../../../server/security/verification-pipeline", () => ({ verifyLink }));
vi.mock("../../../server/cache/redirect-cache", () => ({
	invalidateRedirectCache,
}));

import updateHandler from "./update.patch";

const LINK_ID = "550e8400-e29b-41d4-a716-446655440010";

describe("PATCH /api/links/update", () => {
	beforeEach(() => {
		readBody.mockReset();
		getUserIdFromHeaders.mockReset();
		executeQuery.mockReset();
		executeMutation.mockReset();
		verifyLink.mockReset();
		invalidateRedirectCache.mockClear();
	});

	it("rejects non-owners with 403", async () => {
		readBody.mockResolvedValueOnce({ id: LINK_ID, isActive: false });
		executeQuery.mockResolvedValueOnce({
			data: {
				short_links_by_pk: {
					id: LINK_ID,
					user_id: "owner-1",
					short_url: "abc1234",
					custom_alias: null,
					original_url: "https://example.com",
					is_active: true,
					expires_at: null,
					created_at: "2026-01-01T00:00:00.000Z",
				},
			},
			error: null,
		});

		await expect(
			updateHandler({ context: { user: { id: "other-user" } } } as never),
		).rejects.toMatchObject({ statusCode: 403 });
		expect(executeMutation).not.toHaveBeenCalled();
	});

	it("re-verifies edited destination URLs, updates DB first, and invalidates redirect cache", async () => {
		readBody.mockResolvedValueOnce({
			id: LINK_ID,
			originalUrl: "HTTPS://EXAMPLE.ORG/new-target",
			isActive: false,
		});
		executeQuery.mockResolvedValueOnce({
			data: {
				short_links_by_pk: {
					id: LINK_ID,
					user_id: "owner-1",
					short_url: "abc1234",
					custom_alias: "promo",
					original_url: "https://example.com/old",
					is_active: true,
					expires_at: null,
					created_at: "2026-01-01T00:00:00.000Z",
				},
			},
			error: null,
		});
		verifyLink.mockResolvedValueOnce({
			isVerified: true,
			overallRisk: "safe",
			riskScore: 0,
			summary: { criticalIssues: [] },
		});
		executeMutation.mockResolvedValueOnce({
			data: {
				update_short_links_by_pk: {
					id: LINK_ID,
					user_id: "owner-1",
					short_url: "abc1234",
					custom_alias: "promo",
					original_url: "https://example.org/new-target",
					is_active: false,
					expires_at: null,
					created_at: "2026-01-01T00:00:00.000Z",
				},
			},
			error: null,
		});

		const res = await updateHandler({
			context: { user: { id: "owner-1" } },
		} as never);

		expect(verifyLink).toHaveBeenCalledWith(
			"https://example.org/new-target",
			expect.any(Object),
		);
		expect(res.isActive).toBe(false);
		expect(invalidateRedirectCache).toHaveBeenCalledWith([
			"abc1234",
			"promo",
			"abc1234",
			"promo",
		]);
	});
});
