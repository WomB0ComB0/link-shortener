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
 * Admin store for IP bans, CIDR range bans, and slow-mode entries.
 *
 * Backed by expiry-scored Redis sorted sets (`bans:ip`, `bans:slow`, `bans:cidr`)
 * shared with the hot-path API guard (`./api-guard.ts`).
 */

import {
	BAN_KEYS,
	type BanKind,
	isActiveScore,
	MAX_ACTIVE_CIDRS,
} from "./ban-keys";
import {
	addBanEntry,
	getBanEntryMetadata,
	listActiveBanEntries,
	removeBanEntry,
} from "./ban-store";
import type { BanMetadata } from "./banlist.types";
import { isLoopbackIp, normalizeCidr, normalizeIp } from "./ip";
import { redis } from "./redis";

export { BAN_KEYS as REDIS_KEYS };

function requireIp(ip: string): string {
	const normalized = normalizeIp(ip);
	if (!normalized) {
		throw new Error(`Invalid IP address: ${ip}`);
	}
	return normalized;
}

function requireCidr(cidr: string): string {
	const normalized = normalizeCidr(cidr);
	if (!normalized) {
		throw new Error(`Invalid CIDR range: ${cidr}`);
	}
	return normalized;
}

/**
 * Checks whether an IP has an active (non-expired) ban entry.
 */
export async function isIdentifierBanned(identifier: string): Promise<boolean> {
	const normalized = normalizeIp(identifier);
	if (!normalized || isLoopbackIp(normalized)) return false;

	try {
		const score = await redis.zscore(BAN_KEYS.ip, normalized);
		return isActiveScore(score, Date.now());
	} catch (error) {
		console.error("Error checking identifier ban status", {
			identifier: normalized,
			error,
		});
		return false;
	}
}

/**
 * Checks whether an IP has an active (non-expired) slow-mode entry.
 */
export async function isIdentifierSlowed(identifier: string): Promise<boolean> {
	const normalized = normalizeIp(identifier);
	if (!normalized || isLoopbackIp(normalized)) return false;

	try {
		const score = await redis.zscore(BAN_KEYS.slow, normalized);
		return isActiveScore(score, Date.now());
	} catch (error) {
		console.error("Error checking identifier slow mode status", {
			identifier: normalized,
			error,
		});
		return false;
	}
}

async function addIpEntry(
	kind: Extract<BanKind, "ip" | "slow">,
	rawIp: string,
	reason?: string,
	seconds?: number,
	bannedBy?: string,
): Promise<void> {
	const ip = requireIp(rawIp);
	if (isLoopbackIp(ip)) {
		console.warn("Ignored ban-list entry for loopback address", { ip, kind });
		return;
	}

	const metadata = await addBanEntry(kind, ip, { reason, seconds, bannedBy });
	console.info(kind === "ip" ? "IP banned" : "IP slowed", {
		ip,
		reason,
		bannedBy,
		expiresAt: metadata.expiresAt,
	});
}

export async function banIp(
	ip: string,
	reason?: string,
	seconds?: number,
	bannedBy?: string,
): Promise<void> {
	await addIpEntry("ip", ip, reason, seconds, bannedBy);
}

export async function unbanIp(ip: string): Promise<void> {
	const normalized = requireIp(ip);
	await removeBanEntry("ip", normalized);
	console.info("IP unbanned", { ip: normalized });
}

export async function slowIp(
	ip: string,
	reason?: string,
	seconds?: number,
	bannedBy?: string,
): Promise<void> {
	await addIpEntry("slow", ip, reason, seconds, bannedBy);
}

export async function unslowIp(ip: string): Promise<void> {
	const normalized = requireIp(ip);
	await removeBanEntry("slow", normalized);
	console.info("IP unslowed", { ip: normalized });
}

export async function banCidr(
	cidr: string,
	reason?: string,
	seconds?: number,
	bannedBy?: string,
): Promise<void> {
	const normalized = requireCidr(cidr);
	const active = await listActiveBanEntries("cidr");
	if (active.length >= MAX_ACTIVE_CIDRS && !active.includes(normalized)) {
		throw new Error(
			`CIDR ban list is full (${MAX_ACTIVE_CIDRS} active ranges); lift one first`,
		);
	}
	const metadata = await addBanEntry("cidr", normalized, {
		reason,
		seconds,
		bannedBy,
	});
	console.info("CIDR banned", {
		cidr: normalized,
		reason,
		bannedBy,
		expiresAt: metadata.expiresAt,
	});
}

export async function unbanCidr(cidr: string): Promise<void> {
	const normalized = requireCidr(cidr);
	await removeBanEntry("cidr", normalized);
	console.info("CIDR unbanned", { cidr: normalized });
}

export async function getBannedIps(): Promise<string[]> {
	return listActiveBanEntries("ip");
}

export async function getSlowedIps(): Promise<string[]> {
	return listActiveBanEntries("slow");
}

export async function getBannedCidrs(): Promise<string[]> {
	return listActiveBanEntries("cidr");
}

export async function getBanMetadata(
	ip: string,
	kind: BanKind = "ip",
): Promise<BanMetadata | null> {
	const member = kind === "cidr" ? requireCidr(ip) : requireIp(ip);
	return getBanEntryMetadata(kind, member);
}
