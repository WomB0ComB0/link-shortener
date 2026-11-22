import { beforeEach, describe, expect, it, vi } from "vitest";

const {
	getUserIdFromHeaders,
	resolveAuthenticatedUserId,
	verifyMasterPassword,
} = vi.hoisted(() => ({
	getUserIdFromHeaders: vi.fn(),
	resolveAuthenticatedUserId: vi.fn(),
	verifyMasterPassword: vi.fn(),
}));

vi.mock("../utils/auth.js", () => ({
	getUserIdFromHeaders,
	resolveAuthenticatedUserId,
}));
vi.mock("../utils/helpers.js", () => ({ verifyMasterPassword }));
vi.mock("h3", () => ({
	defineEventHandler: (handler: unknown) => handler,
	getHeader: (event: { headers?: Record<string, string> }, name: string) =>
		event.headers?.[name],
	createError: (input: Record<string, unknown>) =>
		Object.assign(new Error(String(input.message)), input),
}));

import authMiddleware from "./auth";

describe("authentication middleware", () => {
	beforeEach(() => {
		getUserIdFromHeaders.mockReset();
		resolveAuthenticatedUserId.mockReset();
		verifyMasterPassword.mockReset();
	});

	it("allows public routes without credentials", async () => {
		await expect(
			authMiddleware({ path: "/api/links/public" } as never),
		).resolves.toBeUndefined();
	});

	it("accepts a valid session on /api/keys/* and sets event.context.user", async () => {
		getUserIdFromHeaders.mockReturnValue("user-id");
		const event: { path: string; context?: { user?: { id: string } } } = {
			path: "/api/keys/list",
		};

		await expect(authMiddleware(event as never)).resolves.toBeUndefined();
		expect(event.context?.user).toEqual({ id: "user-id" });
		expect(resolveAuthenticatedUserId).not.toHaveBeenCalled();
	});

	it("accepts hashed sk_ API keys on protected link routes", async () => {
		resolveAuthenticatedUserId.mockResolvedValueOnce("api-key-user");
		const event: { path: string; context?: { user?: { id: string } } } = {
			path: "/api/links/create",
		};

		await expect(authMiddleware(event as never)).resolves.toBeUndefined();
		expect(event.context?.user).toEqual({ id: "api-key-user" });
	});

	it("rejects protected routes without authentication", async () => {
		resolveAuthenticatedUserId.mockResolvedValueOnce(null);

		await expect(
			authMiddleware({ path: "/api/links/create", headers: {} } as never),
		).rejects.toMatchObject({ statusCode: 401 });
	});

	it("accepts the configured master password and rejects invalid passwords", async () => {
		getUserIdFromHeaders.mockReturnValue(null);
		verifyMasterPassword.mockReturnValueOnce(true);
		await expect(
			authMiddleware({
				path: "/api/keys/create",
				headers: { "x-master-password": "correct" },
			} as never),
		).resolves.toBeUndefined();

		verifyMasterPassword.mockReturnValueOnce(false);
		await expect(
			authMiddleware({
				path: "/api/keys/create",
				headers: { "x-master-password": "wrong" },
			} as never),
		).rejects.toMatchObject({ statusCode: 403 });
	});
});
