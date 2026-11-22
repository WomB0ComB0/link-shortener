import { describe, expect, it, vi } from "vitest";

const { getQuery, verifyLink } = vi.hoisted(() => ({
	getQuery: vi.fn(),
	verifyLink: vi.fn(),
}));

vi.mock("h3", () => ({
	defineEventHandler: (handler: unknown) => handler,
	getQuery,
	createError: (input: Record<string, unknown>) =>
		Object.assign(new Error(String(input.message)), input),
}));
vi.mock("../../../server/security/verification-pipeline", () => ({
	verifyLink,
}));

import verifyHandler from "./verify.get";

describe("security verification endpoint", () => {
	it("requires a URL query parameter", async () => {
		getQuery.mockReturnValue({});

		await expect(verifyHandler({} as never)).rejects.toMatchObject({
			statusCode: 400,
		});
	});

	it("rejects malformed and non-HTTP(S) URLs before invoking verification", async () => {
		getQuery.mockReturnValue({ url: "not a URL" });

		await expect(verifyHandler({} as never)).rejects.toMatchObject({
			statusCode: 400,
		});

		getQuery.mockReturnValue({ url: "javascript:alert(1)" });

		await expect(verifyHandler({} as never)).rejects.toMatchObject({
			statusCode: 400,
		});
		expect(verifyLink).not.toHaveBeenCalled();
	});

	it("returns verification results and maps failures", async () => {
		getQuery.mockReturnValue({ url: "https://example.com" });
		verifyLink.mockResolvedValueOnce({ isVerified: true });

		await expect(verifyHandler({} as never)).resolves.toEqual({
			success: true,
			verification: { isVerified: true },
		});

		verifyLink.mockRejectedValueOnce(new Error("checker failed"));
		await expect(verifyHandler({} as never)).rejects.toMatchObject({
			statusCode: 500,
			message: "checker failed",
		});
	});
});
