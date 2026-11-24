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
 * GET /api/links/health
 *
 * Returns cached reachability observations for existing active short links and
 * schedules a bounded, leased background pass-through refresh (never blocking
 * the response and never accepting caller-supplied URLs).
 */

import { defineEventHandler, getQuery, setResponseHeader } from "h3";
import {
	readLinkHealth,
	refreshLinkHealth,
} from "../../link-health/runtime";
import type { LinkHealthScope } from "../../link-health/types";

type VercelRequestContext = {
	get?: () => { waitUntil?: (promise: Promise<unknown>) => void } | undefined;
};

const VERCEL_REQUEST_CONTEXT_SYMBOL = Symbol.for("@vercel/request-context");

function getRuntimeWaitUntil(
	event: unknown,
): ((promise: Promise<unknown>) => void) | undefined {
	const vercelCtx = (
		globalThis as Record<PropertyKey, VercelRequestContext | undefined>
	)[VERCEL_REQUEST_CONTEXT_SYMBOL]?.get?.();
	if (typeof vercelCtx?.waitUntil === "function") {
		return (promise) => vercelCtx.waitUntil?.(promise);
	}

	const h3Event = event as {
		context?: { waitUntil?: (promise: Promise<unknown>) => void };
		waitUntil?: (promise: Promise<unknown>) => void;
	};
	if (typeof h3Event?.context?.waitUntil === "function") {
		return (promise) => h3Event.context?.waitUntil?.(promise);
	}
	// On Vercel Node.js, Nitro's `event.waitUntil` only pushes to an internal array
	// that the Vercel Node listener never awaits; only rely on it outside Vercel.
	if (process.env.VERCEL !== "1" && typeof h3Event?.waitUntil === "function") {
		return (promise) => h3Event.waitUntil?.(promise);
	}
	return undefined;
}

export default defineEventHandler(async (event) => {
	const query = getQuery(event);
	const scope: LinkHealthScope = query.scope === "all" ? "all" : "public";

	const result = await readLinkHealth(scope);

	// Schedule non-blocking background refresh using Vercel's real runtime waitUntil
	// (prevents Vercel from freezing the Lambda mid-probe and firing overdue 5s deadlines).
	const refreshPromise = refreshLinkHealth(scope).catch((err) => {
		console.error("[link-health] background refresh failed:", err);
	});
	const runtimeWaitUntil = getRuntimeWaitUntil(event);
	if (runtimeWaitUntil) {
		runtimeWaitUntil(refreshPromise);
	} else if (process.env.VERCEL === "1") {
		// Fallback if Vercel request context is unavailable: bound inline wait so probes
		// finish before the container freezes instead of leaving dangling timers.
		let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
		await Promise.race([
			refreshPromise,
			new Promise<void>((resolve) => {
				fallbackTimer = setTimeout(resolve, 2500);
			}),
		]);
		clearTimeout(fallbackTimer);
	}

	setResponseHeader(
		event,
		"Cache-Control",
		"public, max-age=0, s-maxage=30, stale-while-revalidate=30",
	);

	return result;
});
