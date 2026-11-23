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
 * Operational readiness & lightweight observability snapshot (`GET /api/health`).
 *
 * Exempt from API rate-limiting in `lib/api-guard.ts`. Reports Redis & Hasura
 * readiness alongside redirect SLO latency percentiles, cache hit ratio, and
 * analytics buffer depth.
 */

import { defineEventHandler, setResponseHeader, setResponseStatus } from "h3";
import { HEALTH_CHECK_QUERY } from "../../lib/graphql/operations";
import { getGuardRedis } from "../../lib/redis-guard";
import { clickBuffer } from "../analytics/click-buffer";
import { redirectCache } from "../cache/redirect-cache";
import { metrics } from "../observability/metrics";
import { executeQuery } from "../utils/graphql";

interface DependencyCheck {
	readonly status: "ok" | "degraded" | "unconfigured";
	readonly latencyMs?: number;
}

async function probeRedis(): Promise<DependencyCheck> {
	const redis = getGuardRedis();
	if (!redis) return { status: "unconfigured" };
	const startedAt = performance.now();
	try {
		await redis.ping();
		return {
			status: "ok",
			latencyMs: Number((performance.now() - startedAt).toFixed(2)),
		};
	} catch {
		return {
			status: "degraded",
			latencyMs: Number((performance.now() - startedAt).toFixed(2)),
		};
	}
}

async function probeHasura(): Promise<DependencyCheck> {
	const startedAt = performance.now();
	const { error } = await executeQuery(HEALTH_CHECK_QUERY);
	const latencyMs = Number((performance.now() - startedAt).toFixed(2));
	return error
		? { status: "degraded", latencyMs }
		: { status: "ok", latencyMs };
}

export default defineEventHandler(async (event) => {
	const [redis, hasura] = await Promise.all([probeRedis(), probeHasura()]);
	const healthy = hasura.status === "ok";

	setResponseHeader(event, "Cache-Control", "no-store");
	setResponseStatus(event, healthy ? 200 : 503);

	return {
		status: healthy ? "healthy" : "degraded",
		timestamp: new Date().toISOString(),
		dependencies: {
			hasura,
			redis,
		},
		cache: {
			l1Entries: redirectCache.localSize,
		},
		analytics: {
			pendingBuffer: clickBuffer.pendingCount,
		},
		metrics: metrics.snapshot(),
	};
});
