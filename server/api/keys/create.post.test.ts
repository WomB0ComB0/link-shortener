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

const { default: createKeyHandler } = await import("./create.post");

describe("API key creation endpoint", () => {
	it("requires an authenticated user", async () => {
		await expect(createKeyHandler({ context: {} } as never)).rejects.toMatchObject({
			statusCode: 401,
		});
	});

	it("requires a non-empty key name within 100 characters", async () => {
		readBody.mockResolvedValueOnce({});

		await expect(
			createKeyHandler({ context: { user: { id: "user-id" } } } as never),
		).rejects.toMatchObject({ statusCode: 400 });

		readBody.mockResolvedValueOnce({ name: "   " });
		await expect(
			createKeyHandler({ context: { user: { id: "user-id" } } } as never),
		).rejects.toMatchObject({ statusCode: 400 });

		readBody.mockResolvedValueOnce({ name: "x".repeat(101) });
		await expect(
			createKeyHandler({ context: { user: { id: "user-id" } } } as never),
		).rejects.toMatchObject({ statusCode: 400 });
	});
});
