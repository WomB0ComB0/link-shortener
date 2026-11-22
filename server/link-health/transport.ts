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
 * IP-pinned, SSRF-safe HTTP/HTTPS transport for link-health probing.
 *
 * Connects directly to a pre-validated public IP (never re-resolving DNS),
 * verifies TLS against the original hostname, disables socket pooling/proxies,
 * and destroys the stream immediately after reading status + Location headers.
 */

import { type IncomingMessage, request as httpRequest } from "node:http";
import { type RequestOptions, request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { checkServerIdentity } from "node:tls";
import { classifyIpAddress, isBlockedHostname } from "../security/ip-utils";
import { normalizeLinkUrl } from "./url";

export interface PublicAddress {
	readonly address: string;
	readonly family: 4 | 6;
}

export interface ProbeHeaders {
	readonly status: number;
	readonly location?: string;
}

export interface ProbeRequest {
	readonly url: URL;
	readonly address: PublicAddress;
	readonly method: "HEAD" | "GET";
	readonly signal: AbortSignal;
}

export function toPublicAddress(raw: string): PublicAddress | null {
	const info = classifyIpAddress(raw);
	if (!info.isIp || info.isRestricted || !info.version) return null;
	return { address: info.normalized, family: info.version };
}

function headersOf(response: IncomingMessage): ProbeHeaders {
	return {
		status: response.statusCode ?? 0,
		...(typeof response.headers.location === "string"
			? { location: response.headers.location }
			: {}),
	};
}

export async function requestPinned({
	url,
	address,
	method,
	signal,
}: ProbeRequest): Promise<ProbeHeaders> {
	const checked = toPublicAddress(address.address);
	const hostname = url.hostname.toLowerCase().replace(/\.$/u, "");
	const blockedHost = isBlockedHostname(hostname);

	if (
		!(url instanceof URL) ||
		normalizeLinkUrl(url.href) !== url.href ||
		!checked ||
		checked.address !== address.address ||
		checked.family !== address.family ||
		blockedHost.blocked ||
		!["HEAD", "GET"].includes(method)
	) {
		throw new Error("Unsafe link check target");
	}

	signal.throwIfAborted();
	const secure = url.protocol === "https:";
	const options: RequestOptions = {
		protocol: url.protocol,
		hostname: checked.address,
		family: checked.family,
		port: secure ? 443 : 80,
		path: `${url.pathname}${url.search}`,
		method,
		headers: {
			Host: url.host,
			Accept: "*/*",
			"User-Agent": "Links-Health-Check/1.0 (+https://links.mikeodnis.dev)",
		},
		agent: false,
		signal,
		maxHeaderSize: 8192,
		insecureHTTPParser: false,
		...(secure
			? ({
					servername: isIP(hostname) ? "" : hostname,
					rejectUnauthorized: true,
					checkServerIdentity: (_server, certificate) =>
						checkServerIdentity(hostname, certificate),
				} satisfies Partial<RequestOptions>)
			: {}),
	};

	return new Promise((resolve, reject) => {
		const req = (secure ? httpsRequest : httpRequest)(options, (res) => {
			const headers = headersOf(res);
			res.destroy();
			req.destroy();
			resolve(headers);
		});

		req.on("error", (err) => {
			reject(err);
		});

		req.end();
	});
}
