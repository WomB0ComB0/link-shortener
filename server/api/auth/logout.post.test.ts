import { describe, expect, it, vi } from "vitest";

const { clearSessionCookie } = vi.hoisted(() => ({
	clearSessionCookie: vi.fn(),
}));

vi.mock("h3", () => ({
	defineEventHandler: (handler: unknown) => handler,
}));
vi.mock("../../utils/auth", () => ({ clearSessionCookie }));

import logoutHandler from "./logout.post";

describe("logout endpoint", () => {
	it("clears the HttpOnly session cookie", () => {
		const event = {} as never;
		expect(logoutHandler(event)).toEqual({ success: true });
		expect(clearSessionCookie).toHaveBeenCalledWith(event);
	});
});
