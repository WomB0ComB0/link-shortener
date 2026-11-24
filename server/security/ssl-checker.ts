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
 * SSL/TLS Certificate Validator Module
 * Strict TLS handshake, certificate chain, hostname, protocol, cipher, and SSRF-safe lookup checks.
 */

import dns from "node:dns";
import https from "node:https";
import type { TLSSocket } from "node:tls";
import { Schema as S } from "effect";
import { classifyIpAddress } from "./ip-utils";

// Effect Schema for SSL check result
export class SslCheckResult extends S.Class<SslCheckResult>("SslCheckResult")({
	isValid: S.Boolean,
	url: S.String,
	hasValidCertificate: S.Boolean,
	certificateIssuer: S.optional(S.String),
	certificateSubject: S.optional(S.String),
	validFrom: S.optional(S.Date),
	validTo: S.optional(S.Date),
	daysUntilExpiration: S.optional(S.Number),
	protocol: S.optional(S.String),
	cipher: S.optional(S.String),
	errors: S.Array(S.String),
	warnings: S.Array(S.String),
	checkTime: S.Number,
}) {}

const CERT_ERROR_MESSAGES: Record<string, string> = {
	CERT_HAS_EXPIRED: "SSL certificate has expired",
	CERT_NOT_YET_VALID: "SSL certificate is not yet valid",
	DEPTH_ZERO_SELF_SIGNED_CERT: "SSL certificate is self-signed",
	SELF_SIGNED_CERT_IN_CHAIN: "SSL certificate chain contains a self-signed certificate",
	UNABLE_TO_VERIFY_LEAF_SIGNATURE: "Unable to verify SSL leaf certificate signature",
	UNABLE_TO_GET_ISSUER_CERT_LOCALLY: "SSL certificate issuer is not trusted",
	ERR_TLS_CERT_ALTNAME_INVALID: "SSL certificate hostname mismatch",
	HOSTNAME_MISMATCH: "SSL certificate hostname mismatch",
};

const OUTDATED_TLS_PROTOCOLS = new Set(["SSLv2", "SSLv3", "TLSv1", "TLSv1.0", "TLSv1.1"]);
const WEAK_CIPHER_PATTERN = /(?:RC4|DES|3DES|MD5|NULL|EXPORT|ANON)/i;

/**
 * SSRF-safe DNS lookup callback for outbound TLS sockets.
 * Refuses to connect to any private, loopback, link-local, or reserved IP.
 */
function safeDnsLookup(
	hostname: string,
	options: dns.LookupOptions,
	callback: (
		err: NodeJS.ErrnoException | null,
		address: string | dns.LookupAddress[],
		family?: number,
	) => void,
): void {
	dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
		if (err) {
			callback(err, "");
			return;
		}
		if (!addresses || addresses.length === 0) {
			callback(new Error("DNS lookup returned no addresses"), "");
			return;
		}

		for (const entry of addresses) {
			const classification = classifyIpAddress(entry.address);
			if (classification.isRestricted) {
				callback(
					new Error(
						`Blocked TLS connection to ${classification.reason} IP address: ${entry.address}`,
					),
					"",
				);
				return;
			}
		}

		if (options.all) {
			callback(null, addresses);
		} else {
			const first = addresses[0]!;
			callback(null, first.address, first.family);
		}
	});
}

/**
 * Comprehensive SSL/TLS certificate validation
 */
export async function checkSsl(
	url: string,
	timeoutMs = 8000,
): Promise<SslCheckResult> {
	const errors: string[] = [];
	const warnings: string[] = [];
	const startTime = Date.now();

	// Only check HTTPS URLs
	if (!url.startsWith("https://")) {
		return new SslCheckResult({
			isValid: true, // HTTP is warned and scored separately; HTTPS enforces TLS
			url,
			hasValidCertificate: false,
			errors: [],
			warnings: ["URL uses HTTP instead of HTTPS - not encrypted"],
			checkTime: Date.now() - startTime,
		});
	}

	try {
		const urlObj = new URL(url);
		const port = urlObj.port ? Number(urlObj.port) : 443;

		// Use a dedicated non-pooling agent with TLS session caching disabled so back-to-back
		// checks against the same host always complete a full handshake and return a populated
		// peer certificate (resumed TLS sessions / pooled sockets can yield `{}` in Node).
		const agent = new https.Agent({
			keepAlive: false,
			maxCachedSessions: 0,
		});

		const options: https.RequestOptions = {
			hostname: urlObj.hostname,
			port,
			path: "/",
			method: "HEAD",
			agent,
			rejectUnauthorized: true,
			servername: urlObj.hostname,
			timeout: timeoutMs,
			lookup: safeDnsLookup as https.RequestOptions["lookup"],
		};

		const certificateInfo = await new Promise<{
			valid: boolean;
			certError?: string;
			cert?: any;
			authorized?: boolean;
			protocol?: string | null;
			cipher?: { name?: string } | null;
		}>((resolve, reject) => {
			const req = https.request(options, (res) => {
				const socket = res.socket as TLSSocket;
				const cert = socket.getPeerCertificate();
				const protocol = socket.getProtocol();
				const cipher = socket.getCipher();
				const authorized = socket.authorized;

				// Consume & close immediately to avoid leaking sockets
				res.resume();
				req.destroy();

				resolve({
					valid: Boolean(authorized),
					cert,
					authorized,
					protocol,
					cipher,
				});
			});

			req.on("error", (error: any) => {
				const knownMessage = error?.code ? CERT_ERROR_MESSAGES[error.code] : undefined;
				if (knownMessage) {
					resolve({ valid: false, certError: knownMessage });
				} else {
					reject(error);
				}
			});

			req.on("timeout", () => {
				req.destroy();
				reject(new Error("SSL check timed out"));
			});

			req.end();
		}).finally(() => {
			agent.destroy();
		});

		if (!certificateInfo.valid) {
			errors.push(
				certificateInfo.certError || "SSL certificate is invalid or untrusted",
			);
			return new SslCheckResult({
				isValid: false,
				url,
				hasValidCertificate: false,
				errors,
				warnings,
				checkTime: Date.now() - startTime,
			});
		}

		const cert = certificateInfo.cert;
		if (!cert || !cert.valid_from || !cert.valid_to) {
			errors.push("Server did not present a valid peer SSL certificate");
			return new SslCheckResult({
				isValid: false,
				url,
				hasValidCertificate: false,
				errors,
				warnings,
				checkTime: Date.now() - startTime,
			});
		}

		const validFrom = new Date(cert.valid_from);
		const validTo = new Date(cert.valid_to);
		const now = new Date();
		const daysUntilExpiration = Math.floor(
			(validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
		);

		// Validity window checks
		if (validFrom.getTime() > now.getTime()) {
			errors.push("SSL certificate is not yet valid");
		}
		if (daysUntilExpiration < 0) {
			errors.push("SSL certificate has expired");
		} else if (daysUntilExpiration < 14) {
			warnings.push(`SSL certificate expires soon (${daysUntilExpiration} days)`);
		} else if (daysUntilExpiration < 30) {
			warnings.push(`SSL certificate expires in ${daysUntilExpiration} days`);
		}

		// Reject self-signed leaf certificates
		if (cert.issuer && cert.subject) {
			const issuerCN = cert.issuer.CN;
			const subjectCN = cert.subject.CN;
			if (issuerCN && subjectCN && issuerCN === subjectCN) {
				errors.push("SSL certificate is self-signed");
			}
		}

		// Reject deprecated TLS versions (< TLS 1.2)
		if (certificateInfo.protocol) {
			const protocol = certificateInfo.protocol;
			if (OUTDATED_TLS_PROTOCOLS.has(protocol)) {
				errors.push(`Outdated insecure TLS protocol: ${protocol}`);
			}
		}

		// Reject weak cipher suites
		if (certificateInfo.cipher?.name) {
			const cipher = certificateInfo.cipher.name;
			if (WEAK_CIPHER_PATTERN.test(cipher)) {
				errors.push(`Weak cipher suite negotiated: ${cipher}`);
			}
		}

		return new SslCheckResult({
			isValid: errors.length === 0,
			url,
			hasValidCertificate: errors.length === 0,
			certificateIssuer: cert.issuer?.CN,
			certificateSubject: cert.subject?.CN,
			validFrom,
			validTo,
			daysUntilExpiration,
			protocol: certificateInfo.protocol ?? undefined,
			cipher: certificateInfo.cipher?.name,
			errors,
			warnings,
			checkTime: Date.now() - startTime,
		});
	} catch (error: any) {
		errors.push(`SSL check failed: ${error.message}`);
		return new SslCheckResult({
			isValid: false,
			url,
			hasValidCertificate: false,
			errors,
			warnings,
			checkTime: Date.now() - startTime,
		});
	}
}
