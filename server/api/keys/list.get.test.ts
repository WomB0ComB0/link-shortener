import { describe, expect, it, vi } from "vitest";

vi.mock("h3", () => ({
	defineEventHandler: (handler: unknown) => handler,
	createError: (input: Record<string, unknown>) =>
		Object.assign(new Error(String(input.message)), input),
}));

vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
vi.stubGlobal("createError", (input: Record<string, unknown>) =>
	Object.assign(new Error(String(input.message)), input),
);

const { default: listKeysHandler } = await import("./list.get");

describe("API key listing endpoint", () => {
	it("requires an authenticated user", async () => {
		await expect(listKeysHandler({ context: {} } as never)).rejects.toMatchObject({
			statusCode: 401,
		});
	});
});
