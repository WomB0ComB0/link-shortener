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
 * Dedicated Upstash Redis client for the per-request API guard (`./api-guard.ts`).
 *
 * Kept separate from the general/admin client in `./redis.ts` because hot-path
 * request lookups require strict latency bounds:
 * - `signal` is a FACTORY FUNCTION so every HTTP call gets a fresh AbortSignal
 *   and an abort properly rejects (passing a single AbortSignal object causes
 *   Upstash SDK to return synthetic `{ result }` on subsequent calls).
 * - `retry: { retries: 0 }` makes one fast attempt instead of backing off.
 * - `readYourWrites: false` avoids extra read-your-writes sync overhead.
 * - `enableTelemetry: false` omits telemetry headers.
 */

import { Redis, type RedisConfigNodejs } from "@upstash/redis";

/** Time budget, in ms, for one guard lookup (both per-request HTTP timeout and outer race). */
export const GUARD_BUDGET_MS = 300;

let client: Redis | null | undefined;

/**
 * Build guard client options. Exported for tests; use {@link getGuardRedis} at runtime.
 */
export function guardRedisConfig(
	url: string,
	token: string,
): RedisConfigNodejs {
	return {
		url,
		token,
		signal: () => AbortSignal.timeout(GUARD_BUDGET_MS),
		retry: { retries: 0 },
		readYourWrites: false,
		enableTelemetry: false,
		keepAlive: true,
	};
}

/**
 * Shared guard Redis client, created lazily on first use.
 * Returns `null` when Upstash credentials are not configured (e.g., local tests).
 */
export function getGuardRedis(): Redis | null {
	if (client !== undefined) return client;
	const url = process.env.UPSTASH_REDIS_REST_URL;
	const token = process.env.UPSTASH_REDIS_REST_TOKEN;
	client = url && token ? new Redis(guardRedisConfig(url, token)) : null;
	return client;
}

/** Reset cached guard client (for tests). */
export function resetGuardRedis(): void {
	client = undefined;
}
