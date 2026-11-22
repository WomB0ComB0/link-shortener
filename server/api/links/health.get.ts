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

export default defineEventHandler(async (event) => {
	const query = getQuery(event);
	const scope: LinkHealthScope = query.scope === "all" ? "all" : "public";

	const result = await readLinkHealth(scope);

	// Schedule non-blocking background refresh (Nitro/Vercel waitUntil when available)
	const refreshPromise = refreshLinkHealth(scope).catch((err) => {
		console.error("[link-health] background refresh failed:", err);
	});
	if (typeof (event as any).waitUntil === "function") {
		(event as any).waitUntil(refreshPromise);
	}

	setResponseHeader(
		event,
		"Cache-Control",
		"public, max-age=0, s-maxage=30, stale-while-revalidate=30",
	);

	return result;
});
