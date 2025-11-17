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

import { Ratelimit } from "@upstash/ratelimit";
import { isIdentifierBanned, isIdentifierSlowed } from "./banlist.js";
import { redis } from "./redis.js";

export type RateLimitingType =
	| "default"
	| "forcedSlowMode"
	| "auth"
	| "api"
	| "ai"
	| "create";

export interface RateLimitHelper {
	identifier: string;
	rateLimitingType?: RateLimitingType;
}

/**
 * Map of rate limiters for various strategies, configured for different purposes.
 *
 * @readonly
 * @private
 * @type {Record<RateLimitingType, Ratelimit>}
 */
const limiter = {
	// Default rate limiting: 30 requests per 10 seconds
	default: new Ratelimit({
		redis,
		limiter: Ratelimit.slidingWindow(30, "10 s"),
		analytics: true,
		prefix: "ratelimit:default",
	}),
	// Forced slow mode: 1 request per 30 seconds (for flagged IPs)
	forcedSlowMode: new Ratelimit({
		redis,
		limiter: Ratelimit.slidingWindow(1, "30 s"),
		analytics: true,
		prefix: "ratelimit:slowmode",
	}),
	// Authentication endpoints: 5 requests per 10 seconds
	auth: new Ratelimit({
		redis,
		limiter: Ratelimit.slidingWindow(5, "10 s"),
		analytics: true,
		prefix: "ratelimit:auth",
	}),
	// API endpoints: 30 requests per 60 seconds
	api: new Ratelimit({
		redis,
		limiter: Ratelimit.slidingWindow(30, "60 s"),
		analytics: true,
		prefix: "ratelimit:api",
	}),
	// AI/Analytics endpoints: 20 requests per 24 hours
	ai: new Ratelimit({
		redis,
		limiter: Ratelimit.slidingWindow(20, "24 h"),
		analytics: true,
		prefix: "ratelimit:ai",
	}),
	// Link creation: 10 requests per 60 seconds
	create: new Ratelimit({
		redis,
		limiter: Ratelimit.slidingWindow(10, "60 s"),
		analytics: true,
		prefix: "ratelimit:create",
	}),
} as const satisfies Record<RateLimitingType, Ratelimit>;

/**
 * Returns a rate limiting function for a given type, allowing enforcement of
 * different limiting policies based on the identifier and configuration.
 *
 * The returned function handles internal checks for permanent bans or slow-modes,
 * and logs actions taken. If an identifier is banned, it returns a response with
 * zero remaining credits. If slowed, applies more aggressive limits.
 *
 * @function
 * @public
 * @param {RateLimitingType} [rateLimitingType='default'] - Indicates the type of rate limiting to use. Defaults to 'default'.
 * @returns {(params: RateLimitHelper) => Promise<any>} An async rate limiting function tailored to the type selected.
 * @example
 * const limiter = rateLimiter('create');
 * const res = await limiter({ identifier: 'user-ip-or-id' });
 * if (!res.success) { throw new Error('Rate limited!'); }
 */
export const rateLimiter = (rateLimitingType: RateLimitingType = "default") => {
	/**
	 * Checks the rate limit status for a given identifier and applies ban or slow rules.
	 *
	 * @param {RateLimitHelper} params - The parameters containing the identifier and (optional) rate limiting type.
	 * @returns {Promise<any>} The Upstash Ratelimit response object or a custom rejected response for banned users.
	 */
	return async function rateLimit({ identifier }: RateLimitHelper) {
		// Check if identifier is permanently banned (returns 403-equivalent)
		if (await isIdentifierBanned(identifier)) {
			// Return a rate limit response that will be rejected
			return {
				success: false,
				remaining: 0,
				limit: 0,
				reset: Math.floor(Date.now() / 1_000),
				pending: Promise.resolve(),
			};
		}

		// Check if identifier should be rate-limited more aggressively
		if (await isIdentifierSlowed(identifier)) {
			return limiter.forcedSlowMode.limit(identifier);
		}

		return limiter[rateLimitingType].limit(identifier);
	};
};

/**
 * Utility to convert a rate limit reset timestamp (in seconds) to a formatted locale string for display.
 *
 * @function
 * @public
 * @param {number} result - The reset value in seconds since UNIX epoch.
 * @returns {string} The formatted date/time string.
 * @example
 * getRateLimitReset(1717991018); // → "6/10/2024, 10:43:38 AM"
 */
export const getRateLimitReset = (result: number) =>
	new Date(result * 1000).toLocaleString();
