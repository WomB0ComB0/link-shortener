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
 * General / admin Upstash Redis client singleton.
 *
 * Per-request guard lookups use the dedicated low-latency, timeout-bounded
 * client in `./redis-guard.ts` instead.
 *
 * @module lib/redis
 */

import { Redis } from "@upstash/redis";

export function isRedisConfigured(): boolean {
	return Boolean(
		process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
	);
}

/**
 * Singleton Upstash Redis client for admin writes and general storage.
 * - `keepAlive`: persistent HTTP connections where supported
 * - `readYourWrites`: subsequent reads reflect preceding admin writes
 */
export const redis = new Redis({
	url: process.env.UPSTASH_REDIS_REST_URL || "",
	token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
	keepAlive: true,
	readYourWrites: true,
});
