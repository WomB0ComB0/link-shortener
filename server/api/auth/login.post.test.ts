import { describe, expect, it, vi } from "vitest";

const {
	executeQuery,
	generateSessionToken,
	readBody,
	setSessionCookie,
	verifyPassword,
} = vi.hoisted(() => ({
	executeQuery: vi.fn(),
	generateSessionToken: vi.fn(),
	readBody: vi.fn(),
	setSessionCookie: vi.fn(),
	verifyPassword: vi.fn(),
}));

vi.mock("h3", () => ({
	defineEventHandler: (handler: unknown) => handler,
	readBody,
	createError: (input: Record<string, unknown>) =>
		Object.assign(new Error(String(input.message)), input),
}));
vi.mock("../../utils/graphql", () => ({ executeQuery }));
vi.mock("../../utils/auth", () => ({
	generateSessionToken,
	setSessionCookie,
	verifyPassword,
}));

import loginHandler from "./login.post";

describe("login endpoint", () => {
	it("rejects malformed credentials", async () => {
		readBody.mockResolvedValueOnce({ email: "invalid", password: "short" });

		await expect(loginHandler({} as never)).rejects.toMatchObject({
			statusCode: 400,
		});
	});

	it("rejects unknown users and incorrect passwords", async () => {
		readBody.mockResolvedValueOnce({
			email: "user@example.com",
			password: "StrongPass1",
		});
		executeQuery.mockResolvedValueOnce({ data: { users: [] }, error: null });
		await expect(loginHandler({} as never)).rejects.toMatchObject({
			statusCode: 401,
		});

		readBody.mockResolvedValueOnce({
			email: "user@example.com",
			password: "StrongPass1",
		});
		executeQuery.mockResolvedValueOnce({
			data: {
				users: [
					{
						id: "550e8400-e29b-41d4-a716-446655440000",
						email: "user@example.com",
						password_hash: "hash",
						display_name: null,
						photo_url: null,
						created_at: "2026-01-01T00:00:00.000Z",
					},
				],
			},
			error: null,
		});
		verifyPassword.mockResolvedValueOnce(false);

		await expect(loginHandler({} as never)).rejects.toMatchObject({
			statusCode: 401,
		});
	});

	it("returns a session response for valid credentials", async () => {
		readBody.mockResolvedValueOnce({
			email: "USER@example.com",
			password: "StrongPass1",
		});
		executeQuery.mockResolvedValueOnce({
			data: {
				users: [
					{
						id: "550e8400-e29b-41d4-a716-446655440000",
						email: "user@example.com",
						password_hash: "hash",
						display_name: "User",
						photo_url: null,
						created_at: "2026-01-01T00:00:00.000Z",
					},
				],
			},
			error: null,
		});
		verifyPassword.mockResolvedValueOnce(true);
		generateSessionToken.mockReturnValueOnce("signed-session-token-123");

		const result = await loginHandler({} as never);

		expect(result.token).toBe("signed-session-token-123");
		expect(result.user.email).toBe("user@example.com");
		expect(setSessionCookie).toHaveBeenCalledWith({}, "signed-session-token-123");
		expect(executeQuery).toHaveBeenLastCalledWith(
			expect.any(String),
			{ email: "user@example.com" },
		);
	});
});
