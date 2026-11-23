/**
 * Copyright 2025 Mike Odnis
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
 * Sliding-window Upstash rate limiters cached per Redis client.
 *
 * Matches portfolio's production tuning:
 * - `analytics: false` (prevents writing unbounded `ratelimit:*:events:*` keys)
 * - `timeout: 0` (the API guard races the full lookup against its own 300ms budget)
 * - WeakMap cache keeps Ratelimit's in-memory blocked-identifier cache across requests
 */

import { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";

export type LimiterKind = "api" | "auth" | "create" | "redirect" | "ai" | "slow";

export interface RateLimitResult {
	readonly success: boolean;
	readonly limit: number;
	readonly remaining: number;
	readonly reset: number;
}

export interface RateLimiter {
	limit(identifier: string): Promise<RateLimitResult>;
}

export type Limiters = Record<LimiterKind, RateLimiter>;

/** Sliding-window policy & Redis key prefix for each route class. */
export const RATE_LIMITS = {
	api: { tokens: 30, window: "60 s", prefix: "ratelimit:api" },
	auth: { tokens: 5, window: "10 s", prefix: "ratelimit:auth" },
	create: { tokens: 10, window: "60 s", prefix: "ratelimit:create" },
	redirect: { tokens: 100, window: "60 s", prefix: "ratelimit:redirect" },
	ai: { tokens: 20, window: "86400 s", prefix: "ratelimit:ai" },
	slow: { tokens: 1, window: "30 s", prefix: "ratelimit:slowmode" },
} as const satisfies Record<
	LimiterKind,
	{ tokens: number; window: `${number} s`; prefix: `ratelimit:${string}` }
>;

const cache = new WeakMap<Redis, Limiters>();

function createLimiter(redis: Redis, kind: LimiterKind): Ratelimit {
	const { tokens, window, prefix } = RATE_LIMITS[kind];
	return new Ratelimit({
		redis,
		limiter: Ratelimit.slidingWindow(tokens, window),
		prefix,
		analytics: false,
		timeout: 0,
	});
}

/**
 * Build or retrieve the sliding-window limiters bound to `redis`.
 */
export function getLimiters(redis: Redis): Limiters {
	const existing = cache.get(redis);
	if (existing) return existing;

	const limiters: Limiters = {
		api: createLimiter(redis, "api"),
		auth: createLimiter(redis, "auth"),
		create: createLimiter(redis, "create"),
		redirect: createLimiter(redis, "redirect"),
		ai: createLimiter(redis, "ai"),
		slow: createLimiter(redis, "slow"),
	};
	cache.set(redis, limiters);
	return limiters;
}

/**
 * Format a rate-limit reset timestamp (ms or seconds) for human-readable errors.
 */
export function getRateLimitReset(reset: number): string {
	// Upstash Ratelimit returns reset in milliseconds; support seconds too if < 1e12
	const ms = reset < 1_000_000_000_000 ? reset * 1000 : reset;
	return new Date(ms).toLocaleString();
}
