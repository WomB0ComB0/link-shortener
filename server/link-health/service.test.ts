import { describe, expect, it, vi } from "vitest";
import { createLinkHealthService, type LinkHealthStore } from "./service";
import { CONFIRM_AFTER } from "./state";

describe("link-health service", () => {
	it("never probes on read() and only returns cached non-expired catalog entries", async () => {
		const now = 1_700_000_000_000;
		const probe = vi.fn();
		const store: LinkHealthStore = {
			read: vi.fn().mockResolvedValue({
				"https://a.example/": {
					kind: "reachable",
					status: "reachable",
					checkedAt: now - 1000,
					nextCheckAt: now + 60_000,
				},
				"https://not-in-catalog.example/": {
					kind: "reachable",
					status: "reachable",
					checkedAt: now - 1000,
					nextCheckAt: now + 60_000,
				},
			}),
			acquire: vi.fn(),
			write: vi.fn(),
		};

		const service = createLinkHealthService({
			store,
			catalog: async () => ["https://a.example/"],
			probe,
			now: () => now,
		});

		const result = await service.read("public");
		expect(probe).not.toHaveBeenCalled();
		expect(Object.keys(result.links)).toEqual(["https://a.example/"]);
		expect(result.links["https://a.example/"]?.status).toBe("reachable");
	});

	it("acquires a fenced lease, prioritizes confirming unconfirmed missing links, and writes back", async () => {
		let now = 1_700_000_000_000;
		let persisted: Record<string, unknown> = {
			"https://missing.example/": {
				kind: "missing",
				status: "unknown",
				checkedAt: now - CONFIRM_AFTER,
				nextCheckAt: now,
				missingSince: now - CONFIRM_AFTER,
			},
		};
		const store: LinkHealthStore = {
			read: vi.fn(async () => persisted),
			acquire: vi.fn().mockResolvedValue("lease-token-1"),
			write: vi.fn(async (_scope, records) => {
				persisted = records;
			}),
		};
		const probe = vi.fn(async (url: string) =>
			url.includes("missing")
				? ({ kind: "missing", httpStatus: 404 } as const)
				: ({ kind: "reachable", httpStatus: 200 } as const),
		);

		const service = createLinkHealthService({
			store,
			catalog: async () => [
				"https://fresh.example/",
				"https://missing.example/",
			],
			probe,
			now: () => now,
			batchSize: 2,
		});

		const count = await service.refresh("public");
		expect(count).toBe(2);
		expect(store.write).toHaveBeenCalledWith(
			"public",
			expect.objectContaining({
				"https://missing.example/": expect.objectContaining({
					status: "unavailable",
				}),
				"https://fresh.example/": expect.objectContaining({
					status: "reachable",
				}),
			}),
			"lease-token-1",
		);
	});
});
