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
 * Redis sorted-set key layout for the ban list, shared by the admin store
 * (`./ban-store.ts`, `./banlist.ts`) and the request guard (`./api-guard.ts`).
 *
 * Each list is a sorted set whose member is a normalized IP or CIDR and whose
 * score is its expiry timestamp in milliseconds since epoch.
 */

export type BanKind = "ip" | "slow" | "cidr";

export const BAN_KEYS = {
	/** Banned IP addresses (sorted set: member = normalized IP, score = expiresAt ms). */
	ip: "bans:ip",
	/** IP addresses held to slow-mode rate limit (sorted set). */
	slow: "bans:slow",
	/** Banned CIDR ranges (sorted set: member = normalized CIDR, score = expiresAt ms). */
	cidr: "bans:cidr",
	/** JSON metadata for one entry; expires automatically with temporary entries. */
	meta: (kind: BanKind, member: string): string =>
		`bans:meta:${kind}:${member}`,
} as const;

/**
 * Finite score for permanent bans (max valid JS Date, < 2^53 so JSON round-trips cleanly).
 */
export const PERMANENT_BAN_SCORE = 8_640_000_000_000_000;

/** Upper bound on active CIDR ranges read per request by the API guard. */
export const MAX_ACTIVE_CIDRS = 256;

/**
 * Expiry score in ms: `now + seconds * 1000` for temporary entries, or {@link PERMANENT_BAN_SCORE}.
 */
export function banExpiresAt(
	seconds: number | undefined,
	now: number,
): number {
	return seconds && seconds > 0 ? now + seconds * 1000 : PERMANENT_BAN_SCORE;
}

/**
 * Whether a sorted-set score represents an active (non-expired) entry at `now`.
 */
export function isActiveScore(score: unknown, now: number): boolean {
	if (score === null || score === undefined) return false;
	const value = typeof score === "number" ? score : Number(score);
	return Number.isFinite(value) && value > now;
}
