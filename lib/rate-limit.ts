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
 * Distributed Upstash Redis rate limiters cached per Redis client.
 *
 * Algorithm selection per route class:
 * - Token Bucket (`Ratelimit.tokenBucket`) for burst-tolerant reads (`redirect`, `api`)
 * - Sliding Window (`Ratelimit.slidingWindow`) for strict / expensive / auth routes
 *   (`auth`, `create`, `verify`, `ai`, `slow`)
 *
 * Matches production tuning:
 * - `analytics: false` (prevents writing unbounded `ratelimit:*:events:*` keys)
 * - `timeout: 0` (the API guard races the full lookup against its own 300ms budget)
 * - WeakMap cache keeps Ratelimit's in-memory blocked-identifier cache across requests
 */

import { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";

export type LimiterKind =
	| "api"
	| "auth"
	| "create"
	| "verify"
	| "redirect"
	| "ai"
	| "slow";

export type LimiterAlgorithm = "sliding-window" | "token-bucket";
export type LimiterFailureMode = "local-fallback" | "local-strict";

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

export interface RateLimitPolicyConfig {
	readonly tokens: number;
	readonly window: `${number} s`;
	readonly windowSeconds: number;
	readonly prefix: `ratelimit:${string}`;
	readonly algorithm: LimiterAlgorithm;
	readonly refillRate?: number;
	readonly refillInterval?: `${number} s`;
	readonly failureMode: LimiterFailureMode;
	/** Per-instance fallback cap when Redis is unavailable/circuit-open. */
	readonly localFallbackLimit: number;
}

/** Policy & Redis key prefix for each route class. */
export const RATE_LIMITS = {
	api: {
		tokens: 30,
		window: "60 s",
		windowSeconds: 60,
		prefix: "ratelimit:api",
		algorithm: "token-bucket",
		refillRate: 15,
		refillInterval: "30 s",
		failureMode: "local-fallback",
		localFallbackLimit: 30,
	},
	auth: {
		tokens: 5,
		window: "10 s",
		windowSeconds: 10,
		prefix: "ratelimit:auth",
		algorithm: "sliding-window",
		failureMode: "local-strict",
		localFallbackLimit: 3,
	},
	create: {
		tokens: 10,
		window: "60 s",
		windowSeconds: 60,
		prefix: "ratelimit:create",
		algorithm: "sliding-window",
		failureMode: "local-strict",
		localFallbackLimit: 5,
	},
	verify: {
		tokens: 15,
		window: "60 s",
		windowSeconds: 60,
		prefix: "ratelimit:verify",
		algorithm: "sliding-window",
		failureMode: "local-strict",
		localFallbackLimit: 8,
	},
	redirect: {
		tokens: 100,
		window: "60 s",
		windowSeconds: 60,
		prefix: "ratelimit:redirect",
		algorithm: "token-bucket",
		refillRate: 50,
		refillInterval: "30 s",
		failureMode: "local-fallback",
		localFallbackLimit: 100,
	},
	ai: {
		tokens: 20,
		window: "86400 s",
		windowSeconds: 86_400,
		prefix: "ratelimit:ai",
		algorithm: "sliding-window",
		failureMode: "local-fallback",
		localFallbackLimit: 10,
	},
	slow: {
		tokens: 1,
		window: "30 s",
		windowSeconds: 30,
		prefix: "ratelimit:slowmode",
		algorithm: "sliding-window",
		failureMode: "local-strict",
		localFallbackLimit: 1,
	},
} as const satisfies Record<LimiterKind, RateLimitPolicyConfig>;

const cache = new WeakMap<Redis, Limiters>();

function createLimiter(redis: Redis, kind: LimiterKind): Ratelimit {
	const cfg: RateLimitPolicyConfig = RATE_LIMITS[kind];
	const algorithm =
		cfg.algorithm === "token-bucket" && cfg.refillRate && cfg.refillInterval
			? Ratelimit.tokenBucket(cfg.refillRate, cfg.refillInterval, cfg.tokens)
			: Ratelimit.slidingWindow(cfg.tokens, cfg.window);

	return new Ratelimit({
		redis,
		limiter: algorithm,
		prefix: cfg.prefix,
		analytics: false,
		timeout: 0,
	});
}

/**
 * Build or retrieve the rate limiters bound to `redis`.
 */
export function getLimiters(redis: Redis): Limiters {
	const existing = cache.get(redis);
	if (existing) return existing;

	const limiters: Limiters = {
		api: createLimiter(redis, "api"),
		auth: createLimiter(redis, "auth"),
		create: createLimiter(redis, "create"),
		verify: createLimiter(redis, "verify"),
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

export interface RateLimitHeaderInfo {
	readonly limit: number;
	readonly remaining: number;
	readonly reset: number;
	readonly windowSeconds?: number;
}

/**
 * Build both standard IETF draft `RateLimit-*` + `RateLimit-Policy` headers
 * (delta-seconds reset) and legacy `X-RateLimit-*` headers (+ RFC 9110 `Retry-After` on 429).
 */
export function buildRateLimitHeaders(
	info: RateLimitHeaderInfo,
	options: { isLimited?: boolean; nowMs?: number } = {},
): Record<string, string> {
	const nowMs = options.nowMs ?? Date.now();
	const resetMs =
		info.reset < 1_000_000_000_000 ? info.reset * 1000 : info.reset;
	const deltaSeconds = Math.max(1, Math.ceil((resetMs - nowMs) / 1000));
	const remaining = Math.max(0, info.remaining);

	const headers: Record<string, string> = {
		"RateLimit-Limit": String(info.limit),
		"RateLimit-Remaining": String(remaining),
		"RateLimit-Reset": String(deltaSeconds),
		"X-RateLimit-Limit": String(info.limit),
		"X-RateLimit-Remaining": String(remaining),
		"X-RateLimit-Reset": String(info.reset),
	};

	if (info.windowSeconds && info.windowSeconds > 0) {
		headers["RateLimit-Policy"] = `${info.limit};w=${info.windowSeconds}`;
	}

	if (options.isLimited) {
		headers["Retry-After"] = String(deltaSeconds);
	}

	return headers;
}
