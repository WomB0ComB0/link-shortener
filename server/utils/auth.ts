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
 * Authentication utilities for user sessions (HttpOnly cookie + Bearer),
 * scrypt password hashing, and hashed `sk_` API key verification.
 */

import {
	createHash,
	createHmac,
	randomBytes,
	scryptSync,
	timingSafeEqual,
} from "node:crypto";
import { Schema as S } from "effect";
import { deleteCookie, getCookie, getHeader, setCookie } from "h3";
import {
	EmailSchema,
	JwtTokenSchema,
	PasswordHashSchema,
	PasswordSchema,
	SessionTokenPayload,
} from "../schemas/index";
import { executeMutation, executeQuery } from "./graphql";
import { hashApiKey } from "./helpers";

export const SESSION_COOKIE_NAME = "links_session";
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_SALT_BYTES = 16;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 } as const;

const LOOKUP_API_KEY_BY_HASH = `
  query LookupApiKeyByHash($keyHash: String!) {
    api_keys(
      where: { key: { _eq: $keyHash }, is_active: { _eq: true } }
      limit: 1
    ) {
      id
      user_id
      expires_at
    }
  }
`;

const TOUCH_API_KEY_LAST_USED = `
  mutation TouchApiKeyLastUsed($id: uuid!, $now: timestamptz!) {
    update_api_keys_by_pk(pk_columns: { id: $id }, _set: { last_used_at: $now }) {
      id
    }
  }
`;

/**
 * Hash a password using per-password random salt + scrypt (memory-hard KDF).
 * Format: `scrypt$<32-hex-salt>$<128-hex-derived-key>`
 */
export function hashPassword(password: string): string {
	const salt = randomBytes(SCRYPT_SALT_BYTES).toString("hex");
	const derived = scryptSync(
		password,
		salt,
		SCRYPT_KEY_LENGTH,
		SCRYPT_OPTIONS,
	).toString("hex");
	const hash = `scrypt$${salt}$${derived}`;
	return S.decodeSync(PasswordHashSchema)(hash);
}

/**
 * Verify a password against a salted scrypt hash or legacy SHA-256 hash in constant time.
 */
export function verifyPassword(password: string, hash: string): boolean {
	try {
		S.decodeSync(PasswordHashSchema)(hash);

		if (hash.startsWith("scrypt$")) {
			const parts = hash.split("$");
			if (parts.length !== 3) return false;
			const [, salt, expectedHex] = parts;
			if (!salt || !expectedHex) return false;

			const derived = scryptSync(
				password,
				salt,
				SCRYPT_KEY_LENGTH,
				SCRYPT_OPTIONS,
			);
			const expected = Buffer.from(expectedHex, "hex");
			if (derived.length !== expected.length) return false;
			return timingSafeEqual(derived, expected);
		}

		// Legacy unsalted SHA-256 verification (constant-time)
		const legacyHex = createHash("sha256").update(password).digest("hex");
		const actualBuf = Buffer.from(legacyHex, "hex");
		const expectedBuf = Buffer.from(hash, "hex");
		if (actualBuf.length !== expectedBuf.length) return false;
		return timingSafeEqual(actualBuf, expectedBuf);
	} catch {
		return false;
	}
}

/**
 * Generate a signed HMAC-SHA256 session token.
 */
export function generateSessionToken(userId: string): string {
	const payload = new SessionTokenPayload({
		userId,
		iat: Date.now(),
		exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
	});

	const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
		"base64url",
	);
	const signature = createHmac("sha256", getSessionTokenSecret())
		.update(encodedPayload)
		.digest("base64url");
	const token = `${encodedPayload}.${signature}`;

	return S.decodeSync(JwtTokenSchema)(token);
}

/**
 * Verify and decode a signed session token in constant time.
 */
export function verifySessionToken(token: string): SessionTokenPayload | null {
	try {
		S.decodeSync(JwtTokenSchema)(token);

		const parts = token.split(".");
		if (parts.length !== 2) {
			return null;
		}
		const [encodedPayload, encodedSignature] = parts;
		if (!encodedPayload || !encodedSignature) {
			return null;
		}

		const expectedSignature = createHmac("sha256", getSessionTokenSecret())
			.update(encodedPayload)
			.digest("base64url");
		const providedSignature = Buffer.from(encodedSignature, "base64url");
		const expectedSignatureBuffer = Buffer.from(expectedSignature, "base64url");

		if (
			providedSignature.length !== expectedSignatureBuffer.length ||
			!timingSafeEqual(providedSignature, expectedSignatureBuffer)
		) {
			return null;
		}

		const decoded = JSON.parse(
			Buffer.from(encodedPayload, "base64url").toString(),
		);
		const payload = S.decodeSync(SessionTokenPayload)(decoded);

		if (payload.exp < Date.now()) {
			return null;
		}

		return payload;
	} catch {
		return null;
	}
}

function getSessionTokenSecret(): string {
	const secret = useRuntimeConfig().JWT_SECRET || process.env.JWT_SECRET;
	if (!secret) {
		throw new Error("JWT_SECRET must be configured");
	}
	return secret;
}

/**
 * Attach the signed session token as an HttpOnly, SameSite=Lax cookie.
 */
export function setSessionCookie(event: any, token: string): void {
	setCookie(event, SESSION_COOKIE_NAME, token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: SESSION_MAX_AGE_SECONDS,
	});
}

/**
 * Clear the HttpOnly session cookie on logout.
 */
export function clearSessionCookie(event: any): void {
	deleteCookie(event, SESSION_COOKIE_NAME, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
	});
}

/**
 * Extract a session-authenticated user ID from either:
 * 1. `Authorization: Bearer <session-token>` header (programmatic/session clients)
 * 2. `links_session` HttpOnly cookie (browser sessions)
 */
export function getUserIdFromHeaders(event: any): string | null {
	const authHeader = getHeader(event, "authorization");
	if (authHeader?.startsWith("Bearer ")) {
		const token = authHeader.substring(7).trim();
		if (token && !token.startsWith("sk_")) {
			const decoded = verifySessionToken(token);
			if (decoded?.userId) return decoded.userId;
		}
	}

	const cookieToken = getCookie(event, SESSION_COOKIE_NAME);
	if (cookieToken) {
		const decoded = verifySessionToken(cookieToken);
		if (decoded?.userId) return decoded.userId;
	}

	return null;
}

/**
 * Verify a `sk_...` API key against its SHA-256 hash in Hasura.
 * Updates `last_used_at` asynchronously without blocking the request.
 */
export async function verifyApiKeyFromHeaders(
	event: any,
): Promise<string | null> {
	const authHeader = getHeader(event, "authorization");
	if (!authHeader?.startsWith("Bearer ")) {
		return null;
	}

	const rawKey = authHeader.substring(7).trim();
	if (!rawKey.startsWith("sk_") || rawKey.length < 20) {
		return null;
	}

	const keyHash = hashApiKey(rawKey);
	const { data, error } = await executeQuery<{
		api_keys: Array<{
			id: string;
			user_id: string;
			expires_at: string | null;
		}>;
	}>(LOOKUP_API_KEY_BY_HASH, { keyHash });

	if (error || !data || data.api_keys.length === 0) {
		return null;
	}

	const record = data.api_keys[0];
	if (!record) return null;

	if (record.expires_at && new Date(record.expires_at).getTime() < Date.now()) {
		return null;
	}

	// Fire-and-forget last_used_at audit update
	executeMutation(TOUCH_API_KEY_LAST_USED, {
		id: record.id,
		now: new Date().toISOString(),
	}).catch(() => undefined);

	return record.user_id;
}

/**
 * Resolve authenticated user ID from session (cookie/Bearer) or active `sk_` API key.
 */
export async function resolveAuthenticatedUserId(
	event: any,
	options: { allowApiKey?: boolean } = { allowApiKey: true },
): Promise<string | null> {
	const sessionUserId = getUserIdFromHeaders(event);
	if (sessionUserId) return sessionUserId;

	if (options.allowApiKey !== false) {
		return verifyApiKeyFromHeaders(event);
	}

	return null;
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
 */
export function isValidPassword(password: string): {
	valid: boolean;
	message?: string;
} {
	try {
		S.decodeSync(PasswordSchema)(password);
		return { valid: true };
	} catch (error: any) {
		const message = error?.message || "Invalid password format";
		return { valid: false, message };
	}
}
