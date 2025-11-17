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

import { createError, defineEventHandler } from "h3";
import { isIdentifierBanned } from "../../lib/banlist";
import { getClientIP } from "../../lib/get-ip";
import {
	getRateLimitReset,
	type RateLimitingType,
	rateLimiter,
} from "../../lib/rate-limit";

/**
 * Rate limiting middleware for API routes
 *
 * This middleware applies rate limiting based on the route path:
 * - /api/auth/* - auth rate limiting (5 req/10s)
 * - /api/links/create - create rate limiting (10 req/60s)
 * - /api/links/analytics - ai rate limiting (20 req/24h)
 * - /api/* - default API rate limiting (30 req/60s)
 *
 * It also checks for banned IPs before applying rate limits.
 */
export default defineEventHandler(async (event) => {
	const path = event.path;

	// Skip rate limiting for non-API routes
	if (!path.startsWith("/api/")) {
		return;
	}

	// Get client IP
	const clientIp = getClientIP(event);

	// Skip localhost in development
	if (
		process.env.NODE_ENV === "development" &&
		(clientIp === "127.0.0.1" || clientIp === "::1")
	) {
		return;
	}

	// Check if IP is banned
	if (await isIdentifierBanned(clientIp)) {
		throw createError({
			statusCode: 403,
			statusMessage: "Forbidden",
			message: "Access denied",
		});
	}

	// Determine rate limiting type based on path
	let rateLimitingType: RateLimitingType = "api";

	if (path.startsWith("/api/auth")) {
		rateLimitingType = "auth";
	} else if (path === "/api/links/create") {
		rateLimitingType = "create";
	} else if (path === "/api/links/analytics") {
		rateLimitingType = "ai";
	}

	// Apply rate limiting
	const limiter = rateLimiter(rateLimitingType);
	const result = await limiter({ identifier: clientIp });

	// Set rate limit headers
	event.node.res.setHeader("X-RateLimit-Limit", result.limit.toString());
	event.node.res.setHeader(
		"X-RateLimit-Remaining",
		result.remaining.toString(),
	);
	event.node.res.setHeader("X-RateLimit-Reset", result.reset.toString());

	// Check if rate limit exceeded
	if (!result.success) {
		throw createError({
			statusCode: 429,
			statusMessage: "Too Many Requests",
			message: `Please try again later. Reset time: ${getRateLimitReset(result.reset)}`,
			data: {
				retryAfter: getRateLimitReset(result.reset),
				limit: result.limit,
				remaining: 0,
				reset: result.reset,
			},
		});
	}
});
