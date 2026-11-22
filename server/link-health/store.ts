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
 * Fenced Upstash Redis store for cached link-health observations.
 * Uses a dedicated namespace (`links:link-health:v1:*`) and client so it never
 * interferes with `bans:*` or `ratelimit:*` keys.
 */

import { randomUUID } from "node:crypto";
import { Redis, type RedisConfigNodejs } from "@upstash/redis";
import type { LinkHealthStore } from "./service";

const PREFIX = "links:link-health:v1";
const LEASE_TTL_SECONDS = 30;
const RECORD_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

const SAVE_IF_OWNER = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
return 1
`;

export function linkHealthRedisConfig(
	url: string,
	token: string,
): RedisConfigNodejs {
	return {
		url,
		token,
		signal: () => AbortSignal.timeout(500),
		retry: { retries: 0 },
		readYourWrites: true,
		enableTelemetry: false,
		keepAlive: true,
	};
}

export function createRedisLinkHealthStore(redis: Redis): LinkHealthStore {
	return {
		read: (scope) => redis.get(`${PREFIX}:${scope}`),
		acquire: async () => {
			const token = randomUUID();
			return (await redis.set(`${PREFIX}:lease`, token, {
				ex: LEASE_TTL_SECONDS,
				nx: true,
			})) === "OK"
				? token
				: null;
		},
		write: async (scope, records, lease) => {
			await redis.eval(
				SAVE_IF_OWNER,
				[`${PREFIX}:lease`, `${PREFIX}:${scope}`],
				[lease, JSON.stringify(records), RECORD_TTL_SECONDS],
			);
		},
	};
}

export function connectLinkHealthStore(
	url?: string,
	token?: string,
): LinkHealthStore | null {
	return url && token
		? createRedisLinkHealthStore(new Redis(linkHealthRedisConfig(url, token)))
		: null;
}
