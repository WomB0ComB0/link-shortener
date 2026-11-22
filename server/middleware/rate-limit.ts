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
import { apiGuard } from "../../lib/api-guard";
import { getClientIP } from "../../lib/get-ip";
import { getRateLimitReset } from "../../lib/rate-limit";

/**
 * Pipelined Redis ban, CIDR, slow-mode, and sliding-window rate-limit middleware.
 *
 * Backed by `lib/api-guard.ts` with a 300ms time budget and circuit breaker so
 * Redis hiccups never stall API traffic.
 */
export default defineEventHandler(async (event) => {
	const rawPath = event.path || "/";
	const pathname = rawPath.split("?")[0] || "/";

	// Skip non-API routes immediately
	if (!pathname.startsWith("/api/")) {
		return;
	}

	const method = event.node?.req?.method || "GET";
	const clientIp = getClientIP(event);

	const verdict = await apiGuard.check({
		method,
		pathname,
		clientIp,
	});

	if (verdict.kind === "ban") {
		throw createError({
			statusCode: 403,
			statusMessage: "Forbidden",
			message: "Access denied",
		});
	}

	if (verdict.kind === "limit") {
		const retryAfterSeconds = Math.max(
			1,
			Math.ceil((verdict.reset - Date.now()) / 1000),
		);
		event.node.res.setHeader("X-RateLimit-Limit", String(verdict.limit));
		event.node.res.setHeader(
			"X-RateLimit-Remaining",
			String(verdict.remaining),
		);
		event.node.res.setHeader("X-RateLimit-Reset", String(verdict.reset));
		event.node.res.setHeader("Retry-After", String(retryAfterSeconds));

		const resetFormatted = getRateLimitReset(verdict.reset);
		throw createError({
			statusCode: 429,
			statusMessage: "Too Many Requests",
			message: `Please try again later. Reset time: ${resetFormatted}`,
			data: {
				retryAfter: resetFormatted,
				limit: verdict.limit,
				remaining: 0,
				reset: verdict.reset,
			},
		});
	}

	if (verdict.rateLimit) {
		event.node.res.setHeader(
			"X-RateLimit-Limit",
			String(verdict.rateLimit.limit),
		);
		event.node.res.setHeader(
			"X-RateLimit-Remaining",
			String(verdict.rateLimit.remaining),
		);
		event.node.res.setHeader(
			"X-RateLimit-Reset",
			String(verdict.rateLimit.reset),
		);
	}
});
