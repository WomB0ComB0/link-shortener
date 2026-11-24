import { beforeEach, describe, expect, it, vi } from "vitest";

const { getQuery, setResponseHeader, readLinkHealth, refreshLinkHealth } =
	vi.hoisted(() => ({
		getQuery: vi.fn(),
		setResponseHeader: vi.fn(),
		readLinkHealth: vi.fn(),
		refreshLinkHealth: vi.fn(),
	}));

vi.mock("h3", () => ({
	defineEventHandler: (handler: unknown) => handler,
	getQuery,
	setResponseHeader,
}));
vi.mock("../../link-health/runtime", () => ({
	readLinkHealth,
	refreshLinkHealth,
}));

import healthHandler from "./health.get";

describe("GET /api/links/health endpoint", () => {
	beforeEach(() => {
		getQuery.mockReset();
		setResponseHeader.mockReset();
		readLinkHealth.mockReset();
		refreshLinkHealth.mockReset();
	});

	it("returns cached link health, sets SWR cache headers, and schedules background refresh", async () => {
		getQuery.mockReturnValue({});
		readLinkHealth.mockResolvedValueOnce({
			links: {
				"https://mikeodnis.dev/projects": {
					status: "reachable",
					checkedAt: "2026-11-22T12:00:00.000Z",
				},
			},
		});
		refreshLinkHealth.mockResolvedValueOnce(1);
		const waitUntil = vi.fn();

		const result = await healthHandler({ waitUntil } as never);

		expect(result.links["https://mikeodnis.dev/projects"]?.status).toBe(
			"reachable",
		);
		expect(setResponseHeader).toHaveBeenCalledWith(
			expect.anything(),
			"Cache-Control",
			"public, max-age=0, s-maxage=30, stale-while-revalidate=30",
		);
		expect(waitUntil).toHaveBeenCalledTimes(1);
	});

	it("prefers Vercel request-context waitUntil over Nitro's event.waitUntil", async () => {
		getQuery.mockReturnValue({});
		readLinkHealth.mockResolvedValueOnce({ links: {} });
		refreshLinkHealth.mockResolvedValueOnce(1);

		const vercelWaitUntil = vi.fn();
		const nitroWaitUntil = vi.fn();
		const sym = Symbol.for("@vercel/request-context");
		const prev = (globalThis as Record<PropertyKey, unknown>)[sym];
		(globalThis as Record<PropertyKey, unknown>)[sym] = {
			get: () => ({ waitUntil: vercelWaitUntil }),
		};

		try {
			await healthHandler({ waitUntil: nitroWaitUntil } as never);
			expect(vercelWaitUntil).toHaveBeenCalledTimes(1);
			expect(nitroWaitUntil).not.toHaveBeenCalled();
		} finally {
			if (prev === undefined) {
				delete (globalThis as Record<PropertyKey, unknown>)[sym];
			} else {
				(globalThis as Record<PropertyKey, unknown>)[sym] = prev;
			}
		}
	});
});
