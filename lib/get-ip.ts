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

import type { H3Event } from "h3";

const first = (
	value: string | string[] | null | undefined,
): string | undefined => {
	if (!value) return undefined;
	return Array.isArray(value) ? value[0]?.trim() : value.split(",")[0]?.trim();
};

/**
 * Extracts the originating client IP address in spoofing-resistant header order.
 *
 * Priority:
 * 1. `x-vercel-forwarded-for` (overwritten by Vercel Edge; cannot be spoofed on Vercel)
 * 2. `x-real-ip` (overwritten by Vercel / Nginx reverse proxies)
 * 3. `cf-connecting-ip` (Cloudflare proxy deployments)
 * 4. `x-forwarded-for` (first hop in proxy chain)
 * 5. Direct socket `remoteAddress`
 * 6. `""` (empty string -> maps to `"unknown"` rate-limit bucket, never `"127.0.0.1"` loopback bypass)
 */
export function getClientIP(event: H3Event): string {
	const headers = event.headers;

	const vercelIp = first(headers?.get("x-vercel-forwarded-for"));
	if (vercelIp) return vercelIp;

	const realIp = first(headers?.get("x-real-ip"));
	if (realIp) return realIp;

	const cfIp = first(headers?.get("cf-connecting-ip"));
	if (cfIp) return cfIp;

	const xff = first(headers?.get("x-forwarded-for"));
	if (xff) return xff;

	const remote = event.node?.req?.socket?.remoteAddress?.trim();
	if (remote) return remote;

	return "";
}

/**
 * Get IP geolocation information (placeholder for future provider integration).
 */
export async function getIpLocation(_ip: string): Promise<Record<string, never>> {
	return {};
}
