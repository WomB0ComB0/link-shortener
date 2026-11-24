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
 * Single-hop redirect middleware for `GET /{code}` (R1-R9).
 *
 * Intercepts single-segment non-reserved short codes directly at Nitro level
 * before Vue SSR, eliminating the old double-hop (`/{code}` -> `/api/{code}` -> dest).
 * Enforces the dedicated `redirect` token-bucket rate-limit tier via `apiGuard`
 * and attaches standard IETF `RateLimit-*` + legacy `X-RateLimit-*` headers.
 */

import { createError, defineEventHandler } from "h3";
import { apiGuard } from "../../lib/api-guard";
import { getClientIP } from "../../lib/get-ip";
import {
	buildRateLimitHeaders,
	getRateLimitReset,
} from "../../lib/rate-limit";
import {
	ALIAS_REGEX,
	MAX_CUSTOM_ALIAS_LENGTH,
	RESERVED_ALIASES,
} from "../constants/index";
import { handleShortLinkRedirect } from "../utils/redirect";

export function extractShortCodeFromPath(pathname: string): string | null {
	if (!pathname.startsWith("/") || pathname === "/") return null;
	const segment = pathname.slice(1);
	if (!segment || segment.includes("/")) return null;
	// Never intercept static files with extensions (favicon.ico, manifest.json, etc.)
	if (segment.includes(".")) return null;
	if (segment.length > MAX_CUSTOM_ALIAS_LENGTH) return null;
	if (RESERVED_ALIASES.has(segment.toLowerCase())) return null;
	if (!ALIAS_REGEX.test(segment)) return null;
	return segment;
}

export default defineEventHandler(async (event) => {
	const method = (event.node?.req?.method || "GET").toUpperCase();
	if (method !== "GET" && method !== "HEAD") return;

	const rawPath = event.path || "/";
	const pathname = rawPath.split("?")[0] || "/";
	const code = extractShortCodeFromPath(pathname);
	if (!code) return;

	const clientIp = getClientIP(event);
	const verdict = await apiGuard.check({
		method,
		pathname: `/api/${code}`,
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
			event.node?.res?.setHeader(name, value);
		}

		throw createError({
			statusCode: 429,
			statusMessage: "Too Many Requests",
			message: `Please try again later. Reset time: ${getRateLimitReset(verdict.reset)}`,
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
			event.node?.res?.setHeader(name, value);
		}
	}

	return handleShortLinkRedirect(event, code);
});
