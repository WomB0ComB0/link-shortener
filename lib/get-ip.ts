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

/**
 * Extracts the first value from a header value, handling arrays and comma-separated lists.
 *
 * @function
 * @private
 * @param {string | string[] | null | undefined} value - Header value to extract from. Can be a string, array, null or undefined.
 * @returns {string | undefined} The first value found, or undefined if not present.
 * @example
 * first("123, 456"); // "123"
 * first(["abc", "def"]); // "abc"
 */
const first = (
	value: string | string[] | null | undefined,
): string | undefined => {
	if (!value) return undefined;
	return Array.isArray(value) ? value[0] : value.split(",")[0]?.trim();
};

/**
 * Retrieves the originating client IP address from a request, supporting various cloud and proxy headers.
 * Priority order: CF-Connecting-IP → X-Real-IP → X-Forwarded-For → fallback to 127.0.0.1.
 *
 * Handles requests originating from Cloudflare, Vercel, or other reverse proxies by parsing the corresponding HTTP headers.
 *
 * @function
 * @public
 * @param {H3Event} event - The H3 event object from Nuxt/H3.
 * @returns {string} The detected client IP address, or '127.0.0.1' if none found.
 * @example
 * getClientIP(event); // "203.0.113.42"
 * @see https://developers.cloudflare.com/fundamentals/reference/http-headers/
 * @see https://vercel.com/docs/edge-network/headers
 */
export function getClientIP(event: H3Event): string {
	const headers = event.headers;

	// Cloudflare sets this when traffic passes through CF (preferred)
	const cf = first(
		headers.get("cf-connecting-ip") || headers.get("CF-Connecting-IP"),
	);
	if (cf) return cf;

	// Common reverse proxy header
	const xr = first(headers.get("x-real-ip") || headers.get("X-Real-IP"));
	if (xr) return xr;

	// Standard proxy chain header (get first IP in chain)
	const xff = first(
		headers.get("x-forwarded-for") || headers.get("X-Forwarded-For"),
	);
	if (xff) return xff;

	return "127.0.0.1";
}

/**
 * Get IP geolocation information from ip-api.com
 *
 * @param {string} ip - IP address to lookup
 * @returns {Promise<any>} Geolocation data
 */
export async function getIpLocation(ip: string): Promise<any> {
	// TODO: Implement geolocation service
	// For now, return empty object
	return {};
}
