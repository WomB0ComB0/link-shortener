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

import type { BanMetadata } from "./banlist.types.js";
import { redis } from "./redis.js";

/**
 * @constant
 * @readonly
 * @public
 * @description
 * Redis keys and resolvers used for managing ban and slow mode state.
 * - `BAN_IPS`: Set of permanently banned IP addresses
 * - `BAN_CIDRS`: Set of banned IP CIDR ranges
 * - `SLOW_IPS`: Set of IPs under aggressive (slowmode) rate limiting
 * - `BAN_META`: Function to generate a key for ban metadata by IP
 */
export const REDIS_KEYS = {
	BAN_IPS: "ban:ips",
	BAN_CIDRS: "ban:cidrs",
	SLOW_IPS: "ban:slow",
	BAN_META: (ip: string) => `ban:meta:${ip}`,
} as const;

/**
 * Checks if an arbitrary identifier (IP or user ID) is permanently banned.
 * @async
 * @function
 * @public
 * @param {string} identifier - IP address or user identifier to check
 * @returns {Promise<boolean>} `true` if identifier is banned, `false` otherwise or on error.
 * @example
 *   if(await isIdentifierBanned('203.0.113.99')) { ... }
 */
export async function isIdentifierBanned(identifier: string): Promise<boolean> {
	if (!identifier || identifier === "127.0.0.1" || identifier === "::1")
		return false;

	try {
		const isBanned = await redis.sismember(REDIS_KEYS.BAN_IPS, identifier);
		return !!isBanned;
	} catch (error) {
		console.error("Error checking identifier ban status", {
			identifier,
			error,
		});
		return false;
	}
}

/**
 * Checks if an arbitrary identifier (IP or user ID) is in slowmode.
 * @async
 * @function
 * @public
 * @param {string} identifier - IP address or user identifier to check
 * @returns {Promise<boolean>} `true` if identifier is slowed, `false` otherwise or on error.
 * @example
 *   if(await isIdentifierSlowed('userId123')) { ... }
 */
export async function isIdentifierSlowed(identifier: string): Promise<boolean> {
	if (!identifier || identifier === "127.0.0.1" || identifier === "::1")
		return false;

	try {
		const isSlowed = await redis.sismember(REDIS_KEYS.SLOW_IPS, identifier);
		return !!isSlowed;
	} catch (error) {
		console.error("Error checking identifier slow mode status", {
			identifier,
			error,
		});
		return false;
	}
}

/**
 * Adds an IP address to the ban list with optional metadata and time-to-live.
 * @async
 * @function
 * @public
 * @param {string} ip - IP address to ban
 * @param {string} [reason] - Optional reason for the ban
 * @param {number} [seconds] - Optional time to live (ban expires after this many seconds)
 * @param {string} [bannedBy] - Optional user ID or descriptor of banning authority
 * @returns {Promise<void>}
 * @throws {Error} Throws after logging if Redis fails to apply the ban.
 * @example
 *   await banIp('192.0.2.8', 'Bot activity detected', 3600, 'adminUser');
 */
export async function banIp(
	ip: string,
	reason?: string,
	seconds?: number,
	bannedBy?: string,
): Promise<void> {
	if (!ip || ip === "127.0.0.1" || ip === "::1") {
		console.warn("Attempted to ban localhost or invalid IP", { ip });
		return;
	}

	try {
		await redis.sadd(REDIS_KEYS.BAN_IPS, ip);

		if (reason || bannedBy || seconds) {
			const metadata: BanMetadata = {
				reason,
				ts: Date.now(),
				bannedBy,
			};

			if (seconds) {
				await redis.set(REDIS_KEYS.BAN_META(ip), JSON.stringify(metadata), {
					ex: seconds,
				});
			} else {
				await redis.set(REDIS_KEYS.BAN_META(ip), JSON.stringify(metadata));
			}
		}

		if (seconds) {
			console.info("IP banned temporarily", { ip, reason, seconds });
		} else {
			console.info("IP banned permanently", { ip, reason });
		}
	} catch (error) {
		console.error("Error banning IP", { ip, error });
		throw error;
	}
}

/**
 * Removes an IP address from the ban list and deletes associated metadata.
 * @async
 * @function
 * @public
 * @param {string} ip - IP address to unban
 * @returns {Promise<void>}
 * @throws {Error} Throws after logging if Redis fails to unban.
 * @example
 *   await unbanIp('203.0.113.52');
 */
export async function unbanIp(ip: string): Promise<void> {
	if (!ip) return;

	try {
		await Promise.all([
			redis.srem(REDIS_KEYS.BAN_IPS, ip),
			redis.del(REDIS_KEYS.BAN_META(ip)),
		]);
		console.info("IP unbanned", { ip });
	} catch (error) {
		console.error("Error unbanning IP", { ip, error });
		throw error;
	}
}

/**
 * Adds an IP address to slowmode list, applying more aggressive rate limiting.
 * @async
 * @function
 * @public
 * @param {string} ip - IP address to place in slowmode
 * @param {string} [reason] - Optional reason for slow mode
 * @returns {Promise<void>}
 * @throws {Error} Throws after logging if Redis fails to update slowmode status.
 * @example
 *   await slowIp('198.51.100.10', 'Potential abuse detected');
 */
export async function slowIp(ip: string, reason?: string): Promise<void> {
	if (!ip || ip === "127.0.0.1" || ip === "::1") {
		console.warn("Attempted to slow localhost or invalid IP", { ip });
		return;
	}

	try {
		await redis.sadd(REDIS_KEYS.SLOW_IPS, ip);
		if (reason) {
			await redis.set(
				`slow:meta:${ip}`,
				JSON.stringify({ reason, ts: Date.now() }),
			);
		}
		console.info("IP slowed", { ip, reason });
	} catch (error) {
		console.error("Error slowing IP", { ip, error });
		throw error;
	}
}

/**
 * Removes an IP address from slowmode and deletes its slowmode metadata.
 * @async
 * @function
 * @public
 * @param {string} ip - IP address to remove from slowmode
 * @returns {Promise<void>}
 * @throws {Error} Throws after logging if Redis fails to update slowmode status.
 * @example
 *   await unslowIp('203.0.113.98');
 */
export async function unslowIp(ip: string): Promise<void> {
	if (!ip) return;

	try {
		await Promise.all([
			redis.srem(REDIS_KEYS.SLOW_IPS, ip),
			redis.del(`slow:meta:${ip}`),
		]);
		console.info("IP unslowed", { ip });
	} catch (error) {
		console.error("Error unslowing IP", { ip, error });
		throw error;
	}
}

/**
 * Retrieves all permanently banned IP addresses.
 * @async
 * @function
 * @public
 * @returns {Promise<string[]>} Array of IP addresses
 * @example
 *   const bannedIps = await getBannedIps();
 */
export async function getBannedIps(): Promise<string[]> {
	try {
		const ips = await redis.smembers(REDIS_KEYS.BAN_IPS);
		return ips as string[];
	} catch (error) {
		console.error("Error fetching banned IPs", { error });
		return [];
	}
}

/**
 * Retrieves all IP addresses currently in slowmode.
 * @async
 * @function
 * @public
 * @returns {Promise<string[]>} Array of IP addresses
 * @example
 *   const slowedIps = await getSlowedIps();
 */
export async function getSlowedIps(): Promise<string[]> {
	try {
		const ips = await redis.smembers(REDIS_KEYS.SLOW_IPS);
		return ips as string[];
	} catch (error) {
		console.error("Error fetching slowed IPs", { error });
		return [];
	}
}

/**
 * Retrieves ban metadata for the provided IP, if present.
 * @async
 * @function
 * @public
 * @param {string} ip - IP address to query
 * @returns {Promise<BanMetadata | null>} Metadata object or null if not set or expired.
 * @example
 *   const meta = await getBanMetadata('203.0.113.55');
 */
export async function getBanMetadata(ip: string): Promise<BanMetadata | null> {
	try {
		const data = await redis.get(REDIS_KEYS.BAN_META(ip));
		return data ? JSON.parse(data as string) : null;
	} catch (error) {
		console.error("Error fetching ban metadata", { ip, error });
		return null;
	}
}
