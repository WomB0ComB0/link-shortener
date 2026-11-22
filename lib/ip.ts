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
 * Pure stdlib IP & CIDR helpers for the ban list and API request guard:
 * - Canonical IPv4 & RFC 5952 IPv6 normalization (unwrapping ::ffff:0:0/96 to IPv4)
 * - Canonical CIDR normalization (clearing host bits so ban/unban always match)
 * - Cached in-memory CIDR membership checks
 * - IPv6 /64 rate-limit key derivation (prevents trivial IPv6 address rotation)
 */

import { isIP } from "node:net";

type IpFamily = 4 | 6;

interface ParsedAddress {
	readonly family: IpFamily;
	readonly value: bigint;
}

interface ParsedCidr {
	readonly family: IpFamily;
	readonly network: bigint;
	readonly mask: bigint;
}

const MAX_IP_LENGTH = 45;
const MAX_CIDR_LENGTH = MAX_IP_LENGTH + 4;
const PREFIX_PATTERN = /^(?:0|[1-9]\d{0,2})$/;
const IPV6_KEY_BITS = 64;
const MAPPED_V4_BITS = 96;
const MAPPED_V4_PREFIX = 0xffff00000000n;
const CIDR_CACHE_LIMIT = 1024;

const cidrCache = new Map<string, ParsedCidr | null>();

function familyWidth(family: IpFamily): bigint {
	return family === 4 ? 32n : 128n;
}

function prefixMask(family: IpFamily, prefix: number): bigint {
	const width = familyWidth(family);
	const hostBits = width - BigInt(prefix);
	return ((1n << width) - 1n) ^ ((1n << hostBits) - 1n);
}

function parseIpv4BigInt(raw: string): bigint | null {
	const parts = raw.split(".");
	if (parts.length !== 4) return null;
	let value = 0n;
	for (const part of parts) {
		// Reject leading zeros (e.g., 010) and non-digits
		if (!/^(?:0|[1-9]\d{0,2})$/.test(part)) return null;
		const octet = Number(part);
		if (octet > 255) return null;
		value = (value << 8n) | BigInt(octet);
	}
	return value;
}

function formatIpv4(value: bigint): string {
	return [
		Number((value >> 24n) & 0xffn),
		Number((value >> 16n) & 0xffn),
		Number((value >> 8n) & 0xffn),
		Number(value & 0xffn),
	].join(".");
}

function parseIpv6BigInt(raw: string): bigint | null {
	let addr = raw.toLowerCase();

	// Handle trailing dotted IPv4 (e.g., ::ffff:203.0.113.9)
	const lastColon = addr.lastIndexOf(":");
	if (lastColon !== -1 && addr.slice(lastColon + 1).includes(".")) {
		const v4 = parseIpv4BigInt(addr.slice(lastColon + 1));
		if (v4 === null) return null;
		const hi = Number((v4 >> 16n) & 0xffffn).toString(16);
		const lo = Number(v4 & 0xffffn).toString(16);
		addr = `${addr.slice(0, lastColon)}:${hi}:${lo}`;
	}

	const halves = addr.split("::");
	if (halves.length > 2) return null;

	const left = halves[0] ? halves[0].split(":").filter(Boolean) : [];
	const right =
		halves.length === 2 && halves[1]
			? halves[1].split(":").filter(Boolean)
			: [];

	if (halves.length === 1 && left.length !== 8) return null;
	if (halves.length === 2 && left.length + right.length > 7) return null;

	const missing = halves.length === 2 ? 8 - (left.length + right.length) : 0;
	const groups = [...left, ...Array<string>(missing).fill("0"), ...right];
	if (groups.length !== 8) return null;

	let value = 0n;
	for (const group of groups) {
		if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
		value = (value << 16n) | BigInt(Number.parseInt(group, 16));
	}
	return value;
}

/** Format 128-bit integer to RFC 5952 canonical compressed lowercase IPv6 string. */
function formatIpv6(value: bigint): string {
	const groups: number[] = [];
	for (let shift = 112n; shift >= 0n; shift -= 16n) {
		groups.push(Number((value >> shift) & 0xffffn));
	}

	// Find longest run of >= 2 consecutive zero groups (first wins ties per RFC 5952)
	let bestStart = -1;
	let bestLen = 0;
	let curStart = -1;
	let curLen = 0;

	for (let i = 0; i < 8; i++) {
		if (groups[i] === 0) {
			if (curStart === -1) curStart = i;
			curLen += 1;
			if (curLen > bestLen) {
				bestStart = curStart;
				bestLen = curLen;
			}
		} else {
			curStart = -1;
			curLen = 0;
		}
	}

	if (bestLen < 2) {
		return groups.map((g) => g.toString(16)).join(":");
	}

	const before = groups
		.slice(0, bestStart)
		.map((g) => g.toString(16))
		.join(":");
	const after = groups
		.slice(bestStart + bestLen)
		.map((g) => g.toString(16))
		.join(":");
	return `${before}::${after}`;
}

function isMappedIpv4(value: bigint): boolean {
	return (value & ~0xffffffffn) === MAPPED_V4_PREFIX;
}

function parseAddress(raw: string): ParsedAddress | null {
	const family = isIP(raw);
	if (family === 4) {
		const value = parseIpv4BigInt(raw);
		return value !== null ? { family: 4, value } : null;
	}
	if (family === 6) {
		const value = parseIpv6BigInt(raw);
		return value !== null ? { family: 6, value } : null;
	}
	return null;
}

/**
 * Canonical text form of an IP address, or `null` if invalid.
 * - IPv4 stays dotted-quad (rejects leading zeros, spaces, zones, CIDR suffixes)
 * - IPv6 is lowercase RFC 5952 compressed
 * - IPv4-mapped IPv6 (`::ffff:203.0.113.9`) unwraps to `203.0.113.9`
 */
export function normalizeIp(raw: unknown): string | null {
	if (
		typeof raw !== "string" ||
		raw.length === 0 ||
		raw.length > MAX_IP_LENGTH
	) {
		return null;
	}
	if (raw.includes("%") || raw !== raw.trim()) return null;

	const parsed = parseAddress(raw);
	if (!parsed) return null;

	if (parsed.family === 4) {
		return formatIpv4(parsed.value);
	}
	if (isMappedIpv4(parsed.value)) {
		return formatIpv4(parsed.value & 0xffffffffn);
	}
	return formatIpv6(parsed.value);
}

/**
 * Canonical text form of a CIDR range (host bits cleared), or `null` if invalid.
 * Example: `203.0.113.77/24` -> `203.0.113.0/24`.
 */
export function normalizeCidr(raw: unknown): string | null {
	if (typeof raw !== "string" || raw.length > MAX_CIDR_LENGTH) return null;
	const slash = raw.indexOf("/");
	if (slash <= 0 || slash !== raw.lastIndexOf("/")) return null;

	const host = raw.slice(0, slash);
	const bits = raw.slice(slash + 1);
	if (!PREFIX_PATTERN.test(bits) || host.includes("%") || host !== host.trim()) {
		return null;
	}

	const prefix = Number(bits);
	const parsed = parseAddress(host);
	if (!parsed) return null;

	if (parsed.family === 4) {
		if (prefix > 32) return null;
		const network = parsed.value & prefixMask(4, prefix);
		return `${formatIpv4(network)}/${prefix}`;
	}

	if (prefix > 128) return null;
	if (prefix >= MAPPED_V4_BITS && isMappedIpv4(parsed.value)) {
		const v4Prefix = prefix - MAPPED_V4_BITS;
		const v4Value = parsed.value & 0xffffffffn;
		const network = v4Value & prefixMask(4, v4Prefix);
		return `${formatIpv4(network)}/${v4Prefix}`;
	}

	const network = parsed.value & prefixMask(6, prefix);
	return `${formatIpv6(network)}/${prefix}`;
}

function parseCidr(cidr: string): ParsedCidr | null {
	if (cidrCache.has(cidr)) return cidrCache.get(cidr) ?? null;

	let parsed: ParsedCidr | null = null;
	const normalized = normalizeCidr(cidr);
	if (normalized) {
		const [host = "", bits = ""] = normalized.split("/");
		const addr = parseAddress(host);
		if (addr) {
			const mask = prefixMask(addr.family, Number(bits));
			parsed = { family: addr.family, network: addr.value & mask, mask };
		}
	}

	if (cidrCache.size >= CIDR_CACHE_LIMIT) cidrCache.clear();
	cidrCache.set(cidr, parsed);
	return parsed;
}

/**
 * First CIDR range in `cidrs` containing `ip`, or `null`.
 */
export function findMatchingCidr(
	ip: string,
	cidrs: readonly unknown[],
): string | null {
	if (cidrs.length === 0) return null;
	const normalized = normalizeIp(ip);
	const address = normalized ? parseAddress(normalized) : null;
	if (!address) return null;

	for (const entry of cidrs) {
		const cidr = String(entry);
		const range = parseCidr(cidr);
		if (
			range &&
			range.family === address.family &&
			(address.value & range.mask) === range.network
		) {
			return cidr;
		}
	}
	return null;
}

/**
 * Rate-limit identifier for a normalized IP:
 * - IPv4: the address itself (`203.0.113.9`)
 * - IPv6: its `/64` prefix (`2001:db8:aa:bb::/64`) to prevent per-address rotation
 */
export function rateLimitKey(ip: string): string {
	if (isIP(ip) !== 6) return ip;
	const parsed = parseAddress(ip);
	if (!parsed) return ip;
	const network = parsed.value & prefixMask(6, IPV6_KEY_BITS);
	return `${formatIpv6(network)}/${IPV6_KEY_BITS}`;
}

/**
 * True for loopback addresses (`127.0.0.0/8` and `::1`).
 */
export function isLoopbackIp(ip: string): boolean {
	return ip === "::1" || (isIP(ip) === 4 && ip.startsWith("127."));
}
