import { describe, expect, it } from "vitest";
import { getClientIP, getIpLocation } from "./get-ip";

function eventWithHeaders(
	headers: Record<string, string>,
	remoteAddress?: string,
) {
	return {
		headers: new Headers(headers),
		node: remoteAddress ? { req: { socket: { remoteAddress } } } : undefined,
	} as never;
}

describe("client IP helpers", () => {
	it("prefers Vercel edge headers over spoofable client headers", () => {
		expect(
			getClientIP(
				eventWithHeaders({
					"x-vercel-forwarded-for": "198.51.100.10",
					"cf-connecting-ip": "127.0.0.1",
					"x-real-ip": "203.0.113.2",
				}),
			),
		).toBe("198.51.100.10");

		expect(
			getClientIP(
				eventWithHeaders({
					"x-real-ip": "203.0.113.2",
					"cf-connecting-ip": "127.0.0.1",
				}),
			),
		).toBe("203.0.113.2");

		expect(
			getClientIP(eventWithHeaders({ "cf-connecting-ip": "203.0.113.1" })),
		).toBe("203.0.113.1");

		expect(
			getClientIP(
				eventWithHeaders({ "x-forwarded-for": "203.0.113.3, 10.0.0.1" }),
			),
		).toBe("203.0.113.3");
	});

	it("falls back to socket remoteAddress or empty string (never 127.0.0.1 loopback bypass)", async () => {
		expect(getClientIP(eventWithHeaders({}, "198.51.100.55"))).toBe(
			"198.51.100.55",
		);
		expect(getClientIP(eventWithHeaders({}))).toBe("");
		await expect(getIpLocation("203.0.113.1")).resolves.toEqual({});
	});
});
