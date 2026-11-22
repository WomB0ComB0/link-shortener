import { describe, expect, it, vi } from "vitest";

const {
	executeMutation,
	executeQuery,
	generateSessionToken,
	hashPassword,
	readBody,
	setSessionCookie,
} = vi.hoisted(() => ({
	executeMutation: vi.fn(),
	executeQuery: vi.fn(),
	generateSessionToken: vi.fn(),
	hashPassword: vi.fn(),
	readBody: vi.fn(),
	setSessionCookie: vi.fn(),
}));

vi.mock("h3", () => ({
	defineEventHandler: (handler: unknown) => handler,
	readBody,
	createError: (input: Record<string, unknown>) =>
		Object.assign(new Error(String(input.message)), input),
}));
vi.mock("../../utils/graphql", () => ({ executeMutation, executeQuery }));
vi.mock("../../utils/auth", () => ({
	generateSessionToken,
	hashPassword,
	setSessionCookie,
}));

import registerHandler from "./register.post";

describe("register endpoint", () => {
	it("rejects invalid registration data", async () => {
		readBody.mockResolvedValueOnce({
			email: "invalid",
			password: "weak",
			displayName: "",
		});

		await expect(registerHandler({} as never)).rejects.toMatchObject({
			statusCode: 400,
		});
	});

	it("rejects duplicate email addresses", async () => {
		readBody.mockResolvedValueOnce({
			email: "USER@example.com",
			password: "StrongPass1",
			displayName: "User",
		});
		executeQuery.mockResolvedValueOnce({
			data: { users: [{ id: "existing" }] },
			error: null,
		});

		await expect(registerHandler({} as never)).rejects.toMatchObject({
			statusCode: 409,
		});
	});

	it("creates a user and returns a session response", async () => {
		readBody.mockResolvedValueOnce({
			email: "USER@example.com",
			password: "StrongPass1",
			displayName: "User",
		});
		executeQuery.mockResolvedValueOnce({ data: { users: [] }, error: null });
		hashPassword.mockReturnValueOnce("hashed-password");
		executeMutation.mockResolvedValueOnce({
			data: {
				insert_users_one: {
					id: "550e8400-e29b-41d4-a716-446655440000",
					email: "user@example.com",
					display_name: "User",
					photo_url: null,
					created_at: "2026-01-01T00:00:00.000Z",
				},
			},
			error: null,
		});
		generateSessionToken.mockReturnValueOnce("signed-session-token-123");

		const result = await registerHandler({} as never);

		expect(result.token).toBe("signed-session-token-123");
		expect(result.user.email).toBe("user@example.com");
		expect(setSessionCookie).toHaveBeenCalledWith({}, "signed-session-token-123");
		expect(executeMutation).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				email: "user@example.com",
				passwordHash: "hashed-password",
			}),
		);
	});
});
