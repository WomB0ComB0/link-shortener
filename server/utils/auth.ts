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
 * Authentication utilities for user management
 * Type-safe with Effect Schema
 */

import * as S from "@effect/schema/Schema";
import { createHash } from "crypto";
import { getHeader } from "h3";
import {
	EmailSchema,
	JwtTokenSchema,
	PasswordHashSchema,
	PasswordSchema,
	SessionTokenPayload,
} from "../schemas/index";

/**
 * Hash a password using SHA-256
 * Returns a validated password hash
 */
export function hashPassword(password: string): string {
	const hash = createHash("sha256").update(password).digest("hex");
	// Validate that the hash is correct format
	return S.decodeSync(PasswordHashSchema)(hash);
}

/**
 * Verify a password against its hash
 * Both inputs are validated
 */
export function verifyPassword(password: string, hash: string): boolean {
	try {
		// Validate hash format
		S.decodeSync(PasswordHashSchema)(hash);
		const passwordHash = hashPassword(password);
		return passwordHash === hash;
	} catch {
		return false;
	}
}

/**
 * Generate a type-safe JWT-like token
 * Returns a validated JWT token string
 */
export function generateSessionToken(userId: string): string {
	const payload = new SessionTokenPayload({
		userId,
		iat: Date.now(),
		exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
	});

	// Encode payload
	const token = Buffer.from(JSON.stringify(payload)).toString("base64");

	// Validate token format
	return S.decodeSync(JwtTokenSchema)(token);
}

/**
 * Verify and decode a session token
 * Returns type-safe decoded payload or null
 */
export function verifySessionToken(token: string): SessionTokenPayload | null {
	try {
		// Validate token format first
		S.decodeSync(JwtTokenSchema)(token);

		// Decode and parse
		const decoded = JSON.parse(Buffer.from(token, "base64").toString());

		// Validate payload structure
		const payload = S.decodeSync(SessionTokenPayload)(decoded);

		// Check if token is expired
		if (payload.exp < Date.now()) {
			return null;
		}

		return payload;
	} catch {
		return null;
	}
}

/**
 * Get user ID from request headers
 * Returns validated UUID or null
 */
export function getUserIdFromHeaders(event: any): string | null {
	const authHeader = getHeader(event, "authorization");

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return null;
	}

	const token = authHeader.substring(7); // Remove 'Bearer ' prefix
	const decoded = verifySessionToken(token);

	return decoded?.userId || null;
}

/**
 * Validate email format using Effect Schema
 */
export function isValidEmail(email: string): boolean {
	try {
		S.decodeSync(EmailSchema)(email);
		return true;
	} catch {
		return false;
	}
}

/**
 * Validate password strength using Effect Schema
 * Returns detailed validation result
 */
export function isValidPassword(password: string): {
	valid: boolean;
	message?: string;
} {
	try {
		S.decodeSync(PasswordSchema)(password);
		return { valid: true };
	} catch (error: any) {
		// Extract the first error message from Effect Schema
		const message = error?.message || "Invalid password format";
		return { valid: false, message };
	}
}
