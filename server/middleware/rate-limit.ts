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

import { createHash } from "node:crypto";
import type { H3Event } from "h3";
import { createError, defineEventHandler, getHeader } from "h3";
import {
	apiGuard,
	type GuardTelemetryEvent,
	setApiGuardTelemetryListener,
} from "../../lib/api-guard";
import { getClientIP } from "../../lib/get-ip";
import {
	buildRateLimitHeaders,
	getRateLimitReset,
} from "../../lib/rate-limit";
import { metrics } from "../observability/metrics";
import { getUserIdFromHeaders } from "../utils/auth";

// Wire rate-limiter observability into the shared metrics registry (exposed on /api/health)
setApiGuardTelemetryListener((ev: GuardTelemetryEvent) => {
	metrics.rateLimitEvaluated += 1;
	metrics.recordRateLimitEvalLatency(ev.durationMs);
	if (ev.verdict === "allow") metrics.rateLimitAllowed += 1;
	else if (ev.verdict === "limit") metrics.recordRateLimit429(ev.policy);
	else if (ev.verdict === "ban") metrics.rateLimitBanned403 += 1;
	if (ev.storeError) metrics.rateLimitStoreErrors += 1;
	if (ev.storeTimeout) metrics.rateLimitStoreTimeouts += 1;
	if (ev.circuitOpened) metrics.rateLimitCircuitOpenTrips += 1;
	if (ev.usedLocalFallback) metrics.rateLimitLocalFallbackHits += 1;
});

/**
 * Derive a non-sensitive identity key for rate-limiting without hitting the database:
 * - Signed-in session JWT -> `user:<userId>`
 * - API key (`Bearer sk_...`) -> `apikey:<sha256-16>` (never stores the raw key)
 * - Anonymous -> `undefined` (falls back to normalized client IP)
 */
function resolveRateLimitIdentity(event: H3Event): string | undefined {
	try {
		const contextUserId = event.context?.user?.id;
		if (typeof contextUserId === "string" && contextUserId.length > 0) {
			return `user:${contextUserId}`;
		}

		const authHeader = getHeader(event, "authorization");
		if (authHeader?.startsWith("Bearer sk_")) {
			const rawKey = authHeader.slice("Bearer ".length).trim();
			if (rawKey.length >= 16) {
				const hash = createHash("sha256")
					.update(rawKey)
					.digest("hex")
					.slice(0, 16);
				return `apikey:${hash}`;
			}
		}

		const sessionUserId = getUserIdFromHeaders(event);
		if (sessionUserId) {
			return `user:${sessionUserId}`;
		}
	} catch {
		// Fall back cleanly to IP-based rate limiting if headers/event are partial
	}
	return undefined;
}

/**
 * Pipelined Redis ban, CIDR, slow-mode, and distributed rate-limit middleware.
 *
 * Backed by `lib/api-guard.ts` with a 300ms time budget, circuit breaker,
 * identity-aware keying, in-process local fallback, and standard IETF `RateLimit-*` headers.
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
	const identityKey = resolveRateLimitIdentity(event);

	const verdict = await apiGuard.check({
		method,
		pathname,
		clientIp,
		...(identityKey ? { identityKey } : {}),
	});

	if (verdict.kind === "ban") {
		throw createError({
			statusCode: 403,
			statusMessage: "Forbidden",
			message: "Access denied",
		});
	}

	if (verdict.kind === "limit") {
		const headers = buildRateLimitHeaders(
			{
				limit: verdict.limit,
				remaining: verdict.remaining,
				reset: verdict.reset,
				windowSeconds: verdict.windowSeconds,
			},
			{ isLimited: true },
		);
		for (const [name, value] of Object.entries(headers)) {
			event.node.res.setHeader(name, value);
		}

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
		const headers = buildRateLimitHeaders({
			limit: verdict.rateLimit.limit,
			remaining: verdict.rateLimit.remaining,
			reset: verdict.rateLimit.reset,
			windowSeconds: verdict.rateLimit.windowSeconds,
		});
		for (const [name, value] of Object.entries(headers)) {
			event.node.res.setHeader(name, value);
		}
	}
});
