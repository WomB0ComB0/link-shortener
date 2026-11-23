import type { Redis } from "@upstash/redis";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { metrics } from "../observability/metrics";
import {
	computeCacheTtlSeconds,
	RedirectCache,
} from "./redirect-cache";

function makeFakeRedis() {
	const store = new Map<string, string>();
	const redis = {
		get: vi.fn(async (key: string) => store.get(key) ?? null),
		set: vi.fn(async (key: string, value: string) => {
			store.set(key, value);
			return "OK";
		}),
		del: vi.fn(async (...keys: string[]) => {
			let removed = 0;
			for (const k of keys) {
				if (store.delete(k)) removed += 1;
			}
			return removed;
		}),
	};
	return { redis: redis as unknown as Redis, mocks: redis, store };
}

describe("RedirectCache (L1 LRU + single-flight + L2 Redis + DB fallback)", () => {
	beforeEach(() => {
		metrics.reset();
	});

	it("computes cache TTL as min(24h, expires_at - now)", () => {
		const now = 1_700_000_000_000;
		expect(computeCacheTtlSeconds(null, now)).toBe(86_400);
		expect(
			computeCacheTtlSeconds(new Date(now + 120_000).toISOString(), now),
		).toBe(120);
		expect(
			computeCacheTtlSeconds(new Date(now + 200_000_000).toISOString(), now),
		).toBe(86_400);
		// Already expired links get brief negative-cache TTL
		expect(
			computeCacheTtlSeconds(new Date(now - 5_000).toISOString(), now),
		).toBe(60);
	});

	it("serves L1 hits, falls through to L2 Redis, populates caches on miss, and evicts on invalidate", async () => {
		let clock = 10_000;
		const { redis, mocks } = makeFakeRedis();
		const queryDb = vi.fn().mockResolvedValue({
			data: {
				short_links: [
					{
						id: "link-1",
						short_url: "aB92xK7",
						custom_alias: "docs",
						original_url: "https://example.com/docs",
						is_active: true,
						expires_at: null,
					},
				],
			},
			error: null,
		});

		const cache = new RedirectCache({
			getRedis: () => redis,
			queryDb,
			now: () => clock,
			l1TtlMs: 3_000,
		});

		// 1st lookup: MISS -> DB -> populates L1 + L2
		const first = await cache.resolve("aB92xK7");
		expect(first.status).toBe("ok");
		if (first.status === "ok") {
			expect(first.tier).toBe("miss");
			expect(first.entry.kind).toBe("found");
		}
		expect(queryDb).toHaveBeenCalledTimes(1);

		// 2nd lookup within 3s: L1 hit (no Redis, no DB)
		clock += 1_000;
		const second = await cache.resolve("aB92xK7");
		expect(second.status === "ok" && second.tier).toBe("l1-hit");
		expect(mocks.get).toHaveBeenCalledTimes(1);
		expect(queryDb).toHaveBeenCalledTimes(1);

		// 3rd lookup after L1 expires: L2 Redis hit (no DB)
		clock += 5_000;
		const third = await cache.resolve("aB92xK7");
		expect(third.status === "ok" && third.tier).toBe("l2-hit");
		expect(queryDb).toHaveBeenCalledTimes(1);

		// Invalidate removes both L1 and L2 keys
		await cache.invalidate(["aB92xK7", "docs"]);
		expect(mocks.del).toHaveBeenCalledWith("short:aB92xK7", "short:docs");
		expect(cache.localSize).toBe(0);
	});

	it("coalesces concurrent cache misses with single-flight", async () => {
		let resolveDb!: (v: unknown) => void;
		const queryDb = vi.fn().mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveDb = resolve;
				}),
		);
		const cache = new RedirectCache({ getRedis: () => null, queryDb });

		const p1 = cache.resolve("viral99");
		const p2 = cache.resolve("viral99");
		const p3 = cache.resolve("viral99");

		resolveDb({
			data: {
				short_links: [
					{
						id: "viral-id",
						short_url: "viral99",
						custom_alias: null,
						original_url: "https://example.com/viral",
						is_active: true,
						expires_at: null,
					},
				],
			},
			error: null,
		});

		const results = await Promise.all([p1, p2, p3]);
		expect(results.every((r) => r.status === "ok")).toBe(true);
		expect(queryDb).toHaveBeenCalledTimes(1);
		expect(metrics.singleFlightCoalesced).toBe(2);
	});

	it("negative-caches NOT_FOUND lookups and opens Redis circuit breaker on repeated failures", async () => {
		let clock = 50_000;
		const brokenRedis = {
			get: vi.fn().mockRejectedValue(new Error("redis timeout")),
			set: vi.fn().mockRejectedValue(new Error("redis timeout")),
			del: vi.fn().mockRejectedValue(new Error("redis timeout")),
		} as unknown as Redis;

		const queryDb = vi.fn().mockResolvedValue({
			data: { short_links: [] },
			error: null,
		});

		const cache = new RedirectCache({
			getRedis: () => brokenRedis,
			queryDb,
			now: () => clock,
			l1TtlMs: 1_000,
			redisFailureThreshold: 2,
			redisCooldownMs: 30_000,
		});

		// 1st miss: Redis fails -> falls back to DB -> negative-caches NOT_FOUND in L1
		const r1 = await cache.resolve("nope1");
		expect(r1.status === "ok" && r1.entry.kind).toBe("not_found");

		// Repeat within L1 TTL hits negative cache without DB/Redis
		const r1Again = await cache.resolve("nope1");
		expect(r1Again.status === "ok" && r1Again.tier).toBe("l1-hit");
		expect(queryDb).toHaveBeenCalledTimes(1);

		// 2nd distinct miss trips Redis circuit breaker
		await cache.resolve("nope2");
		const redisCallsAtTrip = (brokenRedis.get as ReturnType<typeof vi.fn>).mock
			.calls.length;

		// 3rd miss during cooldown skips broken Redis completely and goes straight to DB
		clock += 5_000;
		await cache.resolve("nope3");
		expect(
			(brokenRedis.get as ReturnType<typeof vi.fn>).mock.calls.length,
		).toBe(redisCallsAtTrip);
	});
});
