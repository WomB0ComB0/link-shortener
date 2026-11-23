/**
 * Copyright 2026 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Multi-tier cache-aside lookup for the redirect hot path:
 *   1. L1 in-process hot-key LRU (3s TTL, bounded to 2,000 keys)
 *   2. Per-key single-flight coalescing (prevents cache stampedes on viral links)
 *   3. L2 Upstash Redis (`short:<code>`, TTL = min(24h, expires_at - now),
 *      negative cache `NOT_FOUND` for 60s, circuit-broken on Redis outages)
 *   4. Hasura/Postgres DB fallback (returns controlled `db_unavailable` on failure)
 */

import type { Redis } from "@upstash/redis";
import { GET_SHORT_LINK_BY_CODE } from "../../lib/graphql/operations";
import { getGuardRedis } from "../../lib/redis-guard";
import { metrics } from "../observability/metrics";
import { executeQuery } from "../utils/graphql";

export interface CachedShortLink {
	readonly kind: "found";
	readonly id: string;
	readonly shortUrl: string;
	readonly customAlias: string | null;
	readonly originalUrl: string;
	readonly isActive: boolean;
	readonly expiresAt: string | null;
}

export interface CachedNotFound {
	readonly kind: "not_found";
}

export type CachedRedirectEntry = CachedShortLink | CachedNotFound;

export type CacheTier = "l1-hit" | "l2-hit" | "miss";

export type RedirectLookupResult =
	| {
			readonly status: "ok";
			readonly entry: CachedRedirectEntry;
			readonly tier: CacheTier;
	  }
	| {
			readonly status: "db_unavailable";
			readonly error: Error;
	  };

interface RawShortLinkRow {
	readonly id: string;
	readonly short_url?: string;
	readonly custom_alias?: string | null;
	readonly original_url: string;
	readonly is_active: boolean;
	readonly expires_at: string | null;
}

interface L1Slot {
	readonly entry: CachedRedirectEntry;
	readonly expiresAtMs: number;
}

export interface RedirectCacheOptions {
	readonly getRedis?: () => Redis | null;
	readonly queryDb?: (
		code: string,
	) => Promise<{ data: { short_links: RawShortLinkRow[] } | null; error: Error | null }>;
	readonly now?: () => number;
	readonly l1TtlMs?: number;
	readonly l1MaxEntries?: number;
	readonly maxRedisTtlSeconds?: number;
	readonly negativeTtlSeconds?: number;
	readonly redisCooldownMs?: number;
	readonly redisFailureThreshold?: number;
}

export const REDIS_KEY_PREFIX = "short:";
export const DEFAULT_L1_TTL_MS = 3_000;
export const DEFAULT_L1_MAX_ENTRIES = 2_000;
export const DEFAULT_MAX_REDIS_TTL_SECONDS = 86_400; // 24h
export const DEFAULT_NEGATIVE_TTL_SECONDS = 60;
export const DEFAULT_REDIS_COOLDOWN_MS = 30_000;
export const DEFAULT_REDIS_FAILURE_THRESHOLD = 2;

export function cacheKeyFor(code: string): string {
	return `${REDIS_KEY_PREFIX}${code}`;
}

export function computeCacheTtlSeconds(
	expiresAt: string | null,
	nowMs: number = Date.now(),
	maxTtlSeconds: number = DEFAULT_MAX_REDIS_TTL_SECONDS,
): number {
	if (!expiresAt) return maxTtlSeconds;
	const expiryMs = Date.parse(expiresAt);
	if (!Number.isFinite(expiryMs)) return maxTtlSeconds;
	const remainingSeconds = Math.floor((expiryMs - nowMs) / 1000);
	if (remainingSeconds <= 0) {
		// Cache already-expired status briefly so repeated hits stay off the DB.
		return DEFAULT_NEGATIVE_TTL_SECONDS;
	}
	return Math.max(1, Math.min(maxTtlSeconds, remainingSeconds));
}

function parseCachedEntry(raw: unknown): CachedRedirectEntry | null {
	if (!raw) return null;
	let value: unknown = raw;
	if (typeof raw === "string") {
		try {
			value = JSON.parse(raw);
		} catch {
			return null;
		}
	}
	if (typeof value !== "object" || value === null) return null;
	const obj = value as Record<string, unknown>;
	if (obj.kind === "not_found") {
		return { kind: "not_found" };
	}
	if (
		obj.kind === "found" &&
		typeof obj.id === "string" &&
		typeof obj.originalUrl === "string" &&
		typeof obj.isActive === "boolean"
	) {
		return {
			kind: "found",
			id: obj.id,
			shortUrl: typeof obj.shortUrl === "string" ? obj.shortUrl : "",
			customAlias:
				typeof obj.customAlias === "string" ? obj.customAlias : null,
			originalUrl: obj.originalUrl,
			isActive: obj.isActive,
			expiresAt: typeof obj.expiresAt === "string" ? obj.expiresAt : null,
		};
	}
	return null;
}

export class RedirectCache {
	private readonly l1 = new Map<string, L1Slot>();
	private readonly inFlight = new Map<string, Promise<RedirectLookupResult>>();
	private redisConsecutiveFailures = 0;
	private redisSkipUntilMs = 0;

	private readonly getRedis: () => Redis | null;
	private readonly queryDb: (
		code: string,
	) => Promise<{ data: { short_links: RawShortLinkRow[] } | null; error: Error | null }>;
	private readonly now: () => number;
	private readonly l1TtlMs: number;
	private readonly l1MaxEntries: number;
	private readonly maxRedisTtlSeconds: number;
	private readonly negativeTtlSeconds: number;
	private readonly redisCooldownMs: number;
	private readonly redisFailureThreshold: number;

	constructor(options: RedirectCacheOptions = {}) {
		this.getRedis = options.getRedis ?? getGuardRedis;
		this.queryDb =
			options.queryDb ??
			((code) =>
				executeQuery<{ short_links: RawShortLinkRow[] }>(
					GET_SHORT_LINK_BY_CODE,
					{ code },
				));
		this.now = options.now ?? (() => Date.now());
		this.l1TtlMs = options.l1TtlMs ?? DEFAULT_L1_TTL_MS;
		this.l1MaxEntries = options.l1MaxEntries ?? DEFAULT_L1_MAX_ENTRIES;
		this.maxRedisTtlSeconds =
			options.maxRedisTtlSeconds ?? DEFAULT_MAX_REDIS_TTL_SECONDS;
		this.negativeTtlSeconds =
			options.negativeTtlSeconds ?? DEFAULT_NEGATIVE_TTL_SECONDS;
		this.redisCooldownMs = options.redisCooldownMs ?? DEFAULT_REDIS_COOLDOWN_MS;
		this.redisFailureThreshold =
			options.redisFailureThreshold ?? DEFAULT_REDIS_FAILURE_THRESHOLD;
	}

	private readL1(code: string): CachedRedirectEntry | null {
		const slot = this.l1.get(code);
		if (!slot) return null;
		if (this.now() >= slot.expiresAtMs) {
			this.l1.delete(code);
			return null;
		}
		// Refresh LRU recency in O(1)
		this.l1.delete(code);
		this.l1.set(code, slot);
		return slot.entry;
	}

	private writeL1(code: string, entry: CachedRedirectEntry): void {
		if (this.l1MaxEntries <= 0) return;
		if (this.l1.has(code)) {
			this.l1.delete(code);
		} else if (this.l1.size >= this.l1MaxEntries) {
			const oldestKey = this.l1.keys().next().value;
			if (oldestKey !== undefined) {
				this.l1.delete(oldestKey);
			}
		}
		this.l1.set(code, {
			entry,
			expiresAtMs: this.now() + this.l1TtlMs,
		});
	}

	private isRedisCircuitOpen(): boolean {
		return this.now() < this.redisSkipUntilMs;
	}

	private recordRedisFailure(): void {
		metrics.redisErrors += 1;
		this.redisConsecutiveFailures += 1;
		if (this.redisConsecutiveFailures >= this.redisFailureThreshold) {
			this.redisSkipUntilMs = Math.max(
				this.redisSkipUntilMs,
				this.now() + this.redisCooldownMs,
			);
		}
	}

	private recordRedisSuccess(): void {
		this.redisConsecutiveFailures = 0;
	}

	async resolve(code: string): Promise<RedirectLookupResult> {
		// 1. L1 hot-key LRU
		const l1Hit = this.readL1(code);
		if (l1Hit) {
			if (l1Hit.kind === "not_found") {
				metrics.negativeHits += 1;
			} else {
				metrics.l1Hits += 1;
			}
			return { status: "ok", entry: l1Hit, tier: "l1-hit" };
		}

		// 2. Single-flight deduplication per key
		const existingFlight = this.inFlight.get(code);
		if (existingFlight) {
			metrics.singleFlightCoalesced += 1;
			return existingFlight;
		}

		const flight = this.fetchThrough(code).finally(() => {
			this.inFlight.delete(code);
		});
		this.inFlight.set(code, flight);
		return flight;
	}

	private async fetchThrough(code: string): Promise<RedirectLookupResult> {
		const redis = this.isRedisCircuitOpen() ? null : this.getRedis();
		const redisKey = cacheKeyFor(code);

		// 3. L2 Redis cache-aside lookup
		if (redis) {
			try {
				const raw = await redis.get(redisKey);
				this.recordRedisSuccess();
				const parsed = parseCachedEntry(raw);
				if (parsed) {
					this.writeL1(code, parsed);
					if (parsed.kind === "not_found") {
						metrics.negativeHits += 1;
					} else {
						metrics.l2Hits += 1;
					}
					return { status: "ok", entry: parsed, tier: "l2-hit" };
				}
			} catch {
				this.recordRedisFailure();
				metrics.dbFallbacks += 1;
			}
		}

		// 4. DB source-of-truth fallback
		metrics.cacheMisses += 1;
		const { data, error } = await this.queryDb(code);
		if (error || !data) {
			metrics.dbErrors += 1;
			return {
				status: "db_unavailable",
				error: error ?? new Error("Database returned empty payload"),
			};
		}

		const row = data.short_links[0];
		const entry: CachedRedirectEntry = row
			? {
					kind: "found",
					id: row.id,
					shortUrl: row.short_url ?? code,
					customAlias: row.custom_alias ?? null,
					originalUrl: row.original_url,
					isActive: row.is_active,
					expiresAt: row.expires_at ?? null,
				}
			: { kind: "not_found" };

		this.writeL1(code, entry);

		// Populate L2 Redis asynchronously (non-blocking, best-effort)
		if (redis && !this.isRedisCircuitOpen()) {
			const ttlSeconds =
				entry.kind === "not_found"
					? this.negativeTtlSeconds
					: computeCacheTtlSeconds(
							entry.expiresAt,
							this.now(),
							this.maxRedisTtlSeconds,
						);
			redis
				.set(redisKey, JSON.stringify(entry), { ex: ttlSeconds })
				.catch(() => {
					this.recordRedisFailure();
				});
		}

		return { status: "ok", entry, tier: "miss" };
	}

	async invalidate(codes: readonly (string | null | undefined)[]): Promise<void> {
		const unique = [
			...new Set(codes.filter((c): c is string => Boolean(c && c.trim()))),
		];
		if (unique.length === 0) return;

		for (const code of unique) {
			this.l1.delete(code);
		}
		metrics.cacheInvalidations += unique.length;

		const redis = this.getRedis();
		if (!redis) return;

		try {
			const keys = unique.map(cacheKeyFor);
			await redis.del(...keys);
			this.recordRedisSuccess();
		} catch {
			this.recordRedisFailure();
		}
	}

	clearLocal(): void {
		this.l1.clear();
		this.inFlight.clear();
		this.redisConsecutiveFailures = 0;
		this.redisSkipUntilMs = 0;
	}

	get localSize(): number {
		return this.l1.size;
	}
}

export const redirectCache = new RedirectCache();

export function invalidateRedirectCache(
	codes: readonly (string | null | undefined)[],
): Promise<void> {
	return redirectCache.invalidate(codes);
}
