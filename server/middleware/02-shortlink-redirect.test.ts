import { beforeEach, describe, expect, it, vi } from "vitest";

const { check, handleShortLinkRedirect } = vi.hoisted(() => ({
	check: vi.fn(),
	handleShortLinkRedirect: vi.fn(),
}));

vi.mock("h3", () => ({
	defineEventHandler: (handler: unknown) => handler,
	createError: (input: Record<string, unknown>) =>
		Object.assign(new Error(String(input.message)), input),
}));
vi.mock("../../lib/api-guard", () => ({ apiGuard: { check } }));
vi.mock("../../lib/get-ip", () => ({ getClientIP: () => "198.51.100.10" }));
vi.mock("../utils/redirect", () => ({ handleShortLinkRedirect }));

import redirectMiddleware, {
	extractShortCodeFromPath,
} from "./02-shortlink-redirect";

describe("single-hop shortlink redirect middleware", () => {
	beforeEach(() => {
		check.mockReset();
		handleShortLinkRedirect.mockReset();
	});

	it("skips reserved app pages, multi-segment paths, and static assets", () => {
		expect(extractShortCodeFromPath("/")).toBeNull();
		expect(extractShortCodeFromPath("/dashboard")).toBeNull();
		expect(extractShortCodeFromPath("/create")).toBeNull();
		expect(extractShortCodeFromPath("/keys")).toBeNull();
		expect(extractShortCodeFromPath("/auth")).toBeNull();
		expect(extractShortCodeFromPath("/api/abc123")).toBeNull();
		expect(extractShortCodeFromPath("/_nuxt/chunk.js")).toBeNull();
		expect(extractShortCodeFromPath("/favicon.ico")).toBeNull();
		expect(extractShortCodeFromPath("/manifest.json")).toBeNull();
		expect(extractShortCodeFromPath("/aB92xK7")).toBe("aB92xK7");
		expect(extractShortCodeFromPath("/my-custom_alias")).toBe("my-custom_alias");
	});

	it("passes non-redirect routes through to Nuxt SSR", async () => {
		const res = await redirectMiddleware({
			path: "/dashboard",
			node: { req: { method: "GET" } },
		} as never);
		expect(res).toBeUndefined();
		expect(handleShortLinkRedirect).not.toHaveBeenCalled();
	});

	it("enforces apiGuard and dispatches single-hop redirect for short codes", async () => {
		check.mockResolvedValueOnce({ kind: "allow" });
		handleShortLinkRedirect.mockResolvedValueOnce("302-sent");

		const event = {
			path: "/aB92xK7?utm_source=test",
			node: { req: { method: "GET" }, res: { setHeader: vi.fn() } },
		};
		const res = await redirectMiddleware(event as never);
		expect(res).toBe("302-sent");
		expect(check).toHaveBeenCalledWith({
			method: "GET",
			pathname: "/api/aB92xK7",
			clientIp: "198.51.100.10",
		});
		expect(handleShortLinkRedirect).toHaveBeenCalledWith(event, "aB92xK7");
	});
});
