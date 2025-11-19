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
 * Checks SSL certificate validity and security with Effect Schema
 */

import https from "node:https";
import * as S from "@effect/schema/Schema";

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

/**
 * Comprehensive SSL/TLS certificate validation
 */
export async function checkSsl(url: string): Promise<SslCheckResult> {
	const errors: string[] = [];
	const warnings: string[] = [];
	const startTime = Date.now();

	// Only check HTTPS URLs
	if (!url.startsWith("https://")) {
		return new SslCheckResult({
			isValid: true, // HTTP is technically valid, just not secure
			url,
			hasValidCertificate: false,
			errors: [],
			warnings: ["URL uses HTTP instead of HTTPS - not encrypted"],
			checkTime: Date.now() - startTime,
		});
	}

	try {
		const urlObj = new URL(url);
		const options = {
			hostname: urlObj.hostname,
			port: 443,
			path: "/",
			method: "HEAD",
			rejectUnauthorized: true,
			timeout: 10000,
		};

		const certificateInfo = await new Promise<{
			valid: boolean;
			cert?: any;
			protocol?: string;
			cipher?: any;
		}>((resolve, reject) => {
			const req = https.request(options, (res) => {
				const cert = (res.socket as any).getPeerCertificate();
				const protocol = (res.socket as any).getProtocol();
				const cipher = (res.socket as any).getCipher();

				resolve({
					valid: true,
					cert,
					protocol,
					cipher,
				});
			});

			req.on("error", (error: any) => {
				if (error.code === "CERT_HAS_EXPIRED") {
					resolve({ valid: false });
				} else if (error.code === "DEPTH_ZERO_SELF_SIGNED_CERT") {
					resolve({ valid: false });
				} else if (error.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
					resolve({ valid: false });
				} else {
					reject(error);
				}
			});

			req.on("timeout", () => {
				req.destroy();
				reject(new Error("SSL check timed out"));
			});

			req.end();
		});

		if (!certificateInfo.valid) {
			errors.push("SSL certificate is invalid or has expired");
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
		const validFrom = new Date(cert.valid_from);
		const validTo = new Date(cert.valid_to);
		const now = new Date();
		const daysUntilExpiration = Math.floor(
			(validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
		);

		// Certificate expiration warnings
		if (daysUntilExpiration < 0) {
			errors.push("SSL certificate has expired");
		} else if (daysUntilExpiration < 30) {
			warnings.push(`SSL certificate expires in ${daysUntilExpiration} days`);
		}

		// Check for self-signed certificates
		if (cert.issuer && cert.subject) {
			const issuerCN = cert.issuer.CN;
			const subjectCN = cert.subject.CN;
			if (issuerCN === subjectCN) {
				warnings.push("SSL certificate is self-signed");
			}
		}

		// Protocol warnings
		if (certificateInfo.protocol) {
			const protocol = certificateInfo.protocol;
			if (protocol.includes("TLSv1.0") || protocol.includes("TLSv1.1")) {
				warnings.push(`Outdated TLS protocol: ${protocol}`);
			}
		}

		// Cipher warnings
		if (certificateInfo.cipher) {
			const cipher = certificateInfo.cipher.name;
			if (
				cipher.includes("RC4") ||
				cipher.includes("DES") ||
				cipher.includes("MD5")
			) {
				warnings.push(`Weak cipher suite: ${cipher}`);
			}
		}

		return new SslCheckResult({
			isValid: errors.length === 0,
			url,
			hasValidCertificate: true,
			certificateIssuer: cert.issuer?.CN,
			certificateSubject: cert.subject?.CN,
			validFrom,
			validTo,
			daysUntilExpiration,
			protocol: certificateInfo.protocol,
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
