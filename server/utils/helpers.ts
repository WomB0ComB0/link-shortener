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

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { SHORT_URL_CHARSET, SHORT_URL_LENGTH } from "../constants/index.js";
import {
	validateCustomAlias,
	validateEmail,
	validateUrl,
	validateUUID,
} from "../schemas/index.js";

/**
 * Generate a cryptographically unbiased random Base62 short URL code
 * using rejection sampling (discards bytes >= 248 so 248 % 62 === 0).
 */
export function generateShortCode(length: number = SHORT_URL_LENGTH): string {
	const charsetLength = SHORT_URL_CHARSET.length;
	const maxValidByte = Math.floor(256 / charsetLength) * charsetLength; // 248 for Base62
	let result = "";

	while (result.length < length) {
		const bytes = randomBytes(Math.max(16, (length - result.length) * 2));
		for (let i = 0; i < bytes.length && result.length < length; i++) {
			const byte = bytes[i]!;
			if (byte < maxValidByte) {
				result += SHORT_URL_CHARSET[byte % charsetLength];
			}
		}
	}

	return result;
}

/**
 * Normalize a destination URL (lowercase scheme & host via WHATWG URL parser).
 */
export function normalizeDestinationUrl(rawUrl: string): string {
	return new URL(rawUrl.trim()).toString();
}

/**
 * Validate a URL using Effect Schema
 */
export function isValidUrl(url: string): boolean {
	return validateUrl(url);
}

/**
 * Validate a custom alias using Effect Schema
 */
export function isValidAlias(alias: string): boolean {
	return validateCustomAlias(alias);
}

/**
 * Validate an email using Effect Schema
 */
export function isValidEmail(email: string): boolean {
	return validateEmail(email);
}

/**
 * Validate a UUID using Effect Schema
 */
export function isValidUUID(uuid: string): boolean {
	return validateUUID(uuid);
}

/**
 * Generate a secure API key
 */
export function generateApiKey(): string {
	const prefix = "sk_";
	const randomPart = randomBytes(32).toString("base64url");
	return `${prefix}${randomPart}`;
}

/**
 * Hash an API key using SHA-256 for storage and constant-time lookup.
 * High-entropy random API keys (256 bits) do not require a slow KDF.
 */
export function hashApiKey(rawKey: string): string {
	return createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Produce a non-sensitive display mask for an API key (e.g. `sk_Ab12…9zXy`).
 */
export function maskApiKey(rawKey: string): string {
	if (rawKey.length <= 12) return "sk_••••••••";
	return `${rawKey.slice(0, 7)}…${rawKey.slice(-4)}`;
}

/**
 * Hash a password using SHA-256
 */
export function hashPassword(password: string): string {
	return createHash("sha256").update(password).digest("hex");
}

/**
 * Verify a master password
 */
export function verifyMasterPassword(provided: string): boolean {
	const config = useRuntimeConfig();
	const rawHash = config.MASTER_PASSWORD_HASH;
	const masterPasswordHash =
		typeof rawHash === "string" ? rawHash.trim().toLowerCase() : "";

	if (!masterPasswordHash) {
		throw new Error("Master password not configured");
	}

	const providedHash = hashPassword(provided);
	const expectedBuf = Buffer.from(masterPasswordHash, "utf8");
	const actualBuf = Buffer.from(providedHash, "utf8");

	if (expectedBuf.length !== actualBuf.length) {
		return false;
	}

	return timingSafeEqual(expectedBuf, actualBuf);
}
