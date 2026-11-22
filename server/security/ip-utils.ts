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
 * IP & Hostname SSRF Classification Utilities
 * Single source of truth for blocking private, loopback, link-local,
 * cloud metadata, CGNAT, multicast, reserved, and IPv4-mapped IPv6 addresses.
 */

import { isIP } from "node:net";

export interface IpClassification {
	readonly isIp: boolean;
	readonly version: 4 | 6 | null;
	readonly normalized: string;
	readonly isRestricted: boolean;
	readonly reason: string | null;
}

const BLOCKED_HOSTNAMES = new Set([
	"localhost",
	"localhost.localdomain",
	"ip6-localhost",
	"ip6-loopback",
	"metadata.google.internal",
	"metadata.goog",
	"metadata",
	"instance-data",
	"instance-data.ec2.internal",
]);

const BLOCKED_HOSTNAME_SUFFIXES = [
	".localhost",
	".local",
	".localdomain",
	".internal",
	".home.arpa",
	".arpa",
	".lan",
	".corp",
	".intranet",
];

const SELF_SHORTENER_HOSTS = new Set(["links.mikeodnis.dev"]);

/**
 * Strip IPv6 brackets and zone identifiers (e.g. "[fe80::1%eth0]" -> "fe80::1")
 */
export function normalizeIpHost(raw: string): string {
	let value = raw.trim().toLowerCase();
	if (value.startsWith("[") && value.endsWith("]")) {
		value = value.slice(1, -1);
	}
	const zoneIndex = value.indexOf("%");
	if (zoneIndex !== -1) {
		value = value.slice(0, zoneIndex);
	}
	return value;
}

function parseIpv4Octets(ip: string): [number, number, number, number] | null {
	const parts = ip.split(".");
	if (parts.length !== 4) return null;
	const octets: number[] = [];
	for (const part of parts) {
		if (!/^\d{1,3}$/.test(part)) return null;
		const num = Number(part);
		if (num < 0 || num > 255) return null;
		octets.push(num);
	}
	return octets as [number, number, number, number];
}

function classifyIpv4(ip: string): { isRestricted: boolean; reason: string | null } {
	const octets = parseIpv4Octets(ip);
	if (!octets) {
		return { isRestricted: true, reason: "Invalid IPv4" };
	}

	const [a, b, c] = octets;

	// 0.0.0.0/8 - Current network / unspecified
	if (a === 0) return { isRestricted: true, reason: "Reserved (current network)" };
	// 10.0.0.0/8 - RFC 1918 private
	if (a === 10) return { isRestricted: true, reason: "Private network" };
	// 100.64.0.0/10 - RFC 6598 CGNAT / shared address space
	if (a === 100 && b >= 64 && b <= 127) {
		return { isRestricted: true, reason: "Shared CGNAT network" };
	}
	// 127.0.0.0/8 - Loopback
	if (a === 127) return { isRestricted: true, reason: "Loopback" };
	// 169.254.0.0/16 - Link-local & cloud metadata (169.254.169.254)
	if (a === 169 && b === 254) {
		return { isRestricted: true, reason: "Link-local / cloud metadata" };
	}
	// 172.16.0.0/12 - RFC 1918 private (172.16.0.0 - 172.31.255.255)
	if (a === 172 && b >= 16 && b <= 31) {
		return { isRestricted: true, reason: "Private network" };
	}
	// 192.0.0.0/24 - IETF protocol assignments
	if (a === 192 && b === 0 && c === 0) {
		return { isRestricted: true, reason: "Reserved (IETF protocol)" };
	}
	// 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 - Documentation TEST-NETs
	if (
		(a === 192 && b === 0 && c === 2) ||
		(a === 198 && b === 51 && c === 100) ||
		(a === 203 && b === 0 && c === 113)
	) {
		return { isRestricted: true, reason: "Reserved (documentation)" };
	}
	// 192.168.0.0/16 - RFC 1918 private
	if (a === 192 && b === 168) {
		return { isRestricted: true, reason: "Private network" };
	}
	// 198.18.0.0/15 - Network benchmark tests
	if (a === 198 && (b === 18 || b === 19)) {
		return { isRestricted: true, reason: "Reserved (benchmarking)" };
	}
	// 224.0.0.0/4 - Multicast
	if (a >= 224 && a <= 239) {
		return { isRestricted: true, reason: "Multicast" };
	}
	// 240.0.0.0/4 & 255.255.255.255 - Reserved / broadcast
	if (a >= 240) {
		return { isRestricted: true, reason: "Reserved" };
	}

	return { isRestricted: false, reason: null };
}

/**
 * Expand an IPv6 string (supporting :: compression and trailing IPv4 dotted quad)
 * into eight 16-bit integer groups.
 */
function expandIpv6(ip: string): number[] | null {
	let addr = ip.toLowerCase();

	// Handle trailing dotted IPv4 (e.g., ::ffff:127.0.0.1)
	const lastColon = addr.lastIndexOf(":");
	if (lastColon !== -1 && addr.slice(lastColon + 1).includes(".")) {
		const ipv4Part = addr.slice(lastColon + 1);
		const octets = parseIpv4Octets(ipv4Part);
		if (!octets) return null;
		const hi = ((octets[0] << 8) | octets[1]).toString(16);
		const lo = ((octets[2] << 8) | octets[3]).toString(16);
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

	const parsed: number[] = [];
	for (const group of groups) {
		if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
		parsed.push(Number.parseInt(group, 16));
	}
	return parsed;
}

function classifyIpv6(ip: string): { isRestricted: boolean; reason: string | null } {
	const groups = expandIpv6(ip);
	if (!groups) {
		return { isRestricted: true, reason: "Invalid IPv6" };
	}

	const [g0, g1, g2, g3, g4, g5, g6, g7] = groups as [
		number,
		number,
		number,
		number,
		number,
		number,
		number,
		number,
	];

	// ::/128 (unspecified)
	if (groups.every((g) => g === 0)) {
		return { isRestricted: true, reason: "Reserved (unspecified IPv6)" };
	}
	// ::1/128 (loopback)
	if (
		g0 === 0 &&
		g1 === 0 &&
		g2 === 0 &&
		g3 === 0 &&
		g4 === 0 &&
		g5 === 0 &&
		g6 === 0 &&
		g7 === 1
	) {
		return { isRestricted: true, reason: "Loopback" };
	}
	// ::ffff:0:0/96 (IPv4-mapped IPv6) -> validate embedded IPv4
	if (
		g0 === 0 &&
		g1 === 0 &&
		g2 === 0 &&
		g3 === 0 &&
		g4 === 0 &&
		g5 === 0xffff
	) {
		const mappedIpv4 = `${g6 >> 8}.${g6 & 0xff}.${g7 >> 8}.${g7 & 0xff}`;
		const v4 = classifyIpv4(mappedIpv4);
		if (v4.isRestricted) {
			return {
				isRestricted: true,
				reason: `IPv4-mapped ${v4.reason}`,
			};
		}
		return { isRestricted: false, reason: null };
	}
	// 64:ff9b::/96 (NAT64) -> validate embedded IPv4
	if (
		g0 === 0x0064 &&
		g1 === 0xff9b &&
		g2 === 0 &&
		g3 === 0 &&
		g4 === 0 &&
		g5 === 0
	) {
		const mappedIpv4 = `${g6 >> 8}.${g6 & 0xff}.${g7 >> 8}.${g7 & 0xff}`;
		const v4 = classifyIpv4(mappedIpv4);
		if (v4.isRestricted) {
			return {
				isRestricted: true,
				reason: `NAT64 ${v4.reason}`,
			};
		}
	}
	// 100::/64 (Discard-only)
	if (g0 === 0x0100 && g1 === 0 && g2 === 0 && g3 === 0) {
		return { isRestricted: true, reason: "Reserved (discard-only IPv6)" };
	}
	// fc00::/7 (Unique Local Address fc00:: - fdff::)
	if ((g0 & 0xfe00) === 0xfc00) {
		return { isRestricted: true, reason: "Private network (IPv6 ULA)" };
	}
	// fe80::/10 (Link-local)
	if ((g0 & 0xffc0) === 0xfe80) {
		return { isRestricted: true, reason: "Link-local (IPv6)" };
	}
	// fec0::/10 (Deprecated site-local)
	if ((g0 & 0xffc0) === 0xfec0) {
		return { isRestricted: true, reason: "Site-local (IPv6)" };
	}
	// ff00::/8 (Multicast)
	if ((g0 & 0xff00) === 0xff00) {
		return { isRestricted: true, reason: "Multicast (IPv6)" };
	}

	return { isRestricted: false, reason: null };
}

/**
 * Classify an IP string (IPv4 or IPv6, bracketed or plain) for SSRF safety.
 */
export function classifyIpAddress(raw: string): IpClassification {
	const normalized = normalizeIpHost(raw);
	const version = isIP(normalized);

	if (version === 4) {
		const res = classifyIpv4(normalized);
		return {
			isIp: true,
			version: 4,
			normalized,
			isRestricted: res.isRestricted,
			reason: res.reason,
		};
	}

	if (version === 6) {
		const res = classifyIpv6(normalized);
		return {
			isIp: true,
			version: 6,
			normalized,
			isRestricted: res.isRestricted,
			reason: res.reason,
		};
	}

	return {
		isIp: false,
		version: null,
		normalized,
		isRestricted: false,
		reason: null,
	};
}

/**
 * Check whether a hostname is a blocked internal, metadata, or self-redirect domain.
 */
export function isBlockedHostname(rawHostname: string): {
	blocked: boolean;
	reason: string | null;
	category: "private" | "self" | null;
} {
	const hostname = normalizeIpHost(rawHostname).replace(/\.+$/, "");

	if (!hostname) {
		return { blocked: true, reason: "Missing hostname", category: "private" };
	}

	if (BLOCKED_HOSTNAMES.has(hostname)) {
		return {
			blocked: true,
			reason: "URLs pointing to localhost or private networks are not allowed",
			category: "private",
		};
	}

	if (BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
		return {
			blocked: true,
			reason: "URLs pointing to localhost or private networks are not allowed",
			category: "private",
		};
	}

	// Self-redirect loop prevention
	if (SELF_SHORTENER_HOSTS.has(hostname)) {
		return {
			blocked: true,
			reason: "Self-referential shortener URLs are not allowed",
			category: "self",
		};
	}

	const configuredBaseUrl = process.env.BASE_URL;
	if (configuredBaseUrl) {
		try {
			const baseHost = new URL(configuredBaseUrl).hostname.toLowerCase();
			if (baseHost && baseHost !== "localhost" && baseHost !== "127.0.0.1" && hostname === baseHost) {
				return {
					blocked: true,
					reason: "Self-referential shortener URLs are not allowed",
					category: "self",
				};
			}
		} catch {
			// Ignore malformed BASE_URL
		}
	}

	return { blocked: false, reason: null, category: null };
}
