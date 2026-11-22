import { describe, expect, it, vi } from "vitest";

const { readBody } = vi.hoisted(() => ({ readBody: vi.fn() }));

vi.mock("h3", () => ({
	defineEventHandler: (handler: unknown) => handler,
	readBody,
	createError: (input: Record<string, unknown>) =>
		Object.assign(new Error(String(input.message)), input),
}));

vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
vi.stubGlobal("readBody", readBody);
vi.stubGlobal("createError", (input: Record<string, unknown>) =>
	Object.assign(new Error(String(input.message)), input),
);

const { default: revokeKeyHandler } = await import("./revoke.post");

describe("API key revocation endpoint", () => {
	it("requires an authenticated user", async () => {
		await expect(revokeKeyHandler({ context: {} } as never)).rejects.toMatchObject({
			statusCode: 401,
		});
	});

	it("requires a valid UUID key ID", async () => {
		readBody.mockResolvedValueOnce({});

		await expect(
			revokeKeyHandler({ context: { user: { id: "user-id" } } } as never),
		).rejects.toMatchObject({ statusCode: 400 });

		readBody.mockResolvedValueOnce({ keyId: "not-a-uuid" });

		await expect(
			revokeKeyHandler({ context: { user: { id: "user-id" } } } as never),
		).rejects.toMatchObject({ statusCode: 400 });
	});
});
