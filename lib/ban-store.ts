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
 * Sorted-set primitives behind the admin ban store (`./banlist.ts`).
 * Entries live in `bans:<kind>` scored by expiry in ms; expired members are
 * pruned on every admin write, removal, and list.
 */

import {
	BAN_KEYS,
	type BanKind,
	banExpiresAt,
	PERMANENT_BAN_SCORE,
} from "./ban-keys";
import type { BanEntryOptions, BanMetadata } from "./banlist.types";
import { redis } from "./redis";

const SORTED_SET: Record<BanKind, string> = {
	ip: BAN_KEYS.ip,
	slow: BAN_KEYS.slow,
	cidr: BAN_KEYS.cidr,
};

const ALL_SORTED_SETS: readonly string[] = Object.values(SORTED_SET);

function pruneExpiredEntries(now: number): Promise<number[]> {
	return Promise.all(
		ALL_SORTED_SETS.map((key) => redis.zremrangebyscore(key, "-inf", now)),
	);
}

export async function addBanEntry(
	kind: BanKind,
	member: string,
	{ reason, seconds, bannedBy }: BanEntryOptions,
	now: number = Date.now(),
): Promise<BanMetadata> {
	const key = SORTED_SET[kind];
	const metaKey = BAN_KEYS.meta(kind, member);
	const score = banExpiresAt(seconds, now);
	const temporary = score !== PERMANENT_BAN_SCORE;
	const metadata: BanMetadata = {
		ts: now,
		expiresAt: temporary ? score : null,
		...(reason ? { reason } : {}),
		...(bannedBy ? { bannedBy } : {}),
	};

	await Promise.all([
		redis.zadd(key, { score, member }),
		temporary
			? redis.set(metaKey, metadata, { pxat: score })
			: redis.set(metaKey, metadata),
		pruneExpiredEntries(now),
	]);
	return metadata;
}

export async function removeBanEntry(
	kind: BanKind,
	member: string,
	now: number = Date.now(),
): Promise<void> {
	await Promise.all([
		redis.zrem(SORTED_SET[kind], member),
		redis.del(BAN_KEYS.meta(kind, member)),
		pruneExpiredEntries(now),
	]);
}

export async function listActiveBanEntries(
	kind: BanKind,
	now: number = Date.now(),
): Promise<string[]> {
	const key = SORTED_SET[kind];
	const [, members] = await Promise.all([
		pruneExpiredEntries(now),
		redis.zrange<unknown[]>(key, `(${now}` as `(${number}`, "+inf", {
			byScore: true,
		}),
	]);
	return members.map(String);
}

export async function getBanEntryMetadata(
	kind: BanKind,
	member: string,
): Promise<BanMetadata | null> {
	return redis.get<BanMetadata>(BAN_KEYS.meta(kind, member));
}
