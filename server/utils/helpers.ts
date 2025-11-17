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

import { createHash, randomBytes } from "node:crypto";
import { SHORT_URL_CHARSET, SHORT_URL_LENGTH } from "../constants/index.js";
import {
	validateCustomAlias,
	validateEmail,
	validateUrl,
	validateUUID,
} from "../schemas/index.js";

/**
 * Generate a random short URL code
 */
export function generateShortCode(length: number = SHORT_URL_LENGTH): string {
	let result = "";
	const charsetLength = SHORT_URL_CHARSET.length;
	const bytes = randomBytes(length);

	for (let i = 0; i < length; i++) {
		result += SHORT_URL_CHARSET[bytes[i]! % charsetLength];
	}

	return result;
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
	const masterPasswordHash = config.MASTER_PASSWORD_HASH;

	if (!masterPasswordHash) {
		throw new Error("Master password not configured");
	}

	const providedHash = hashPassword(provided);
	return providedHash === masterPasswordHash;
}
