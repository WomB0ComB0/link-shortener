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
 * Shared redirect hot-path execution (R1-R9).
 *
 * Used by both single-hop `GET /{code}` middleware and `/api/{code}` route:
 * - Multi-tier cache-aside lookup (L1 LRU -> single-flight -> L2 Redis -> DB)
 * - R6 re-validation on EVERY hit and miss (`isActive`, `expiresAt`, destination URL guard)
 * - Non-blocking privacy-preserving analytics enqueue
 * - `302 Found` with `Cache-Control: private, max-age=90` & hardened headers
 */

import type { H3Event } from "h3";
import {
	createError,
	getHeader,
	sendRedirect,
	setResponseHeader,
} from "h3";
import { enqueueClick } from "../analytics/click-buffer";
import { redirectCache } from "../cache/redirect-cache";
import { metrics } from "../observability/metrics";
import { validateUrl } from "../security/url-validator";

const REDIRECT_CACHE_CONTROL = "private, max-age=90";

export async function handleShortLinkRedirect(
	event: H3Event,
	code: string | undefined,
): Promise<unknown> {
	const startedAt = performance.now();
	metrics.redirectsTotal += 1;

	if (!code) {
		throw createError({
			statusCode: 400,
			statusMessage: "Bad Request",
			message: "Short URL code is required",
		});
	}

	const lookup = await redirectCache.resolve(code);

	if (lookup.status === "db_unavailable") {
		metrics.status503 += 1;
		setResponseHeader(event, "Cache-Control", "no-store");
		metrics.recordRedirectLatency(performance.now() - startedAt);
		throw createError({
			statusCode: 503,
			statusMessage: "Service Unavailable",
			message: "Link lookup service is temporarily unavailable",
		});
	}

	setResponseHeader(event, "X-Cache", lookup.tier.toUpperCase());

	if (lookup.entry.kind === "not_found") {
		metrics.status404 += 1;
		setResponseHeader(event, "Cache-Control", "no-store");
		metrics.recordRedirectLatency(performance.now() - startedAt);
		throw createError({
			statusCode: 404,
			statusMessage: "Not Found",
			message: "Short link not found",
		});
	}

	const link = lookup.entry;

	// R6: A cache HIT is never a free pass — status & expiry are re-checked on every request.
	if (!link.isActive) {
		metrics.status410 += 1;
		setResponseHeader(event, "Cache-Control", "no-store");
		metrics.recordRedirectLatency(performance.now() - startedAt);
		throw createError({
			statusCode: 410,
			statusMessage: "Gone",
			message: "This short link has been disabled",
		});
	}

	if (link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now()) {
		metrics.status410 += 1;
		setResponseHeader(event, "Cache-Control", "no-store");
		metrics.recordRedirectLatency(performance.now() - startedAt);
		throw createError({
			statusCode: 410,
			statusMessage: "Gone",
			message: "This short link has expired",
		});
	}

	// Defense-in-depth: fast CPU-only destination URL check before redirecting
	const urlCheck = await validateUrl(link.originalUrl);
	if (!urlCheck.isValid) {
		metrics.status403 += 1;
		setResponseHeader(event, "Cache-Control", "no-store");
		metrics.recordRedirectLatency(performance.now() - startedAt);
		throw createError({
			statusCode: 403,
			statusMessage: "Forbidden",
			message: "Redirect blocked: destination URL failed security validation",
		});
	}

	// A1: Non-blocking, privacy-preserving analytics enqueue (no raw IP, zero awaits)
	const userAgent = getHeader(event, "user-agent");
	const referrer = getHeader(event, "referer") || getHeader(event, "referrer");
	const country =
		getHeader(event, "x-vercel-ip-country") ||
		getHeader(event, "cf-ipcountry") ||
		null;
	const city = getHeader(event, "x-vercel-ip-city") || null;

	enqueueClick({
		shortLinkId: link.id,
		userAgent,
		referrer,
		country,
		city,
	});

	// R8: Hardened 302 Found with short private cache so takedowns/edits propagate quickly
	setResponseHeader(event, "Cache-Control", REDIRECT_CACHE_CONTROL);
	setResponseHeader(event, "Referrer-Policy", "no-referrer");
	setResponseHeader(event, "X-Robots-Tag", "noindex, nofollow");

	metrics.status302 += 1;
	metrics.recordRedirectLatency(performance.now() - startedAt);

	return sendRedirect(event, link.originalUrl, 302);
}
