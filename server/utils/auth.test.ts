import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
	generateSessionToken,
	getUserIdFromHeaders,
	hashPassword,
	isValidEmail,
	isValidPassword,
	SESSION_COOKIE_NAME,
	verifyPassword,
	verifySessionToken,
} from "./auth";
import { generateApiKey, hashApiKey, maskApiKey } from "./helpers";

const userId = "550e8400-e29b-41d4-a716-446655440000";
const secret = "test-session-secret";

function encodePayload(payload: object): string {
	return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function signedToken(payload: object): string {
	const encoded = encodePayload(payload);
	const signature = createHmac("sha256", secret)
		.update(encoded)
		.digest("base64url");
	return `${encoded}.${signature}`;
}

describe("authentication utilities", () => {
	it("hashes and verifies passwords with per-password salted scrypt and legacy SHA-256", () => {
		const hashA = hashPassword("Password1");
		const hashB = hashPassword("Password1");

		expect(hashA).toMatch(/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
		expect(hashA).not.toBe(hashB);
		expect(verifyPassword("Password1", hashA)).toBe(true);
		expect(verifyPassword("Password1", hashB)).toBe(true);
		expect(verifyPassword("wrong", hashA)).toBe(false);
		expect(verifyPassword("Password1", "invalid")).toBe(false);

		// Legacy SHA-256 hash backwards compatibility ("password")
		expect(
			verifyPassword(
				"password",
				"5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
			),
		).toBe(true);
	});

	it("round-trips signed session tokens", () => {
		vi.stubGlobal("useRuntimeConfig", () => ({ JWT_SECRET: secret }));

		const token = generateSessionToken(userId);
		const decoded = verifySessionToken(token);

		expect(decoded?.userId).toBe(userId);
		expect(decoded?.exp).toBeGreaterThan(decoded?.iat ?? 0);
	});

	it("rejects unsigned, tampered, malformed, and expired tokens", () => {
		vi.stubGlobal("useRuntimeConfig", () => ({ JWT_SECRET: secret }));

		const valid = generateSessionToken(userId);
		const [payload] = valid.split(".");
		const tampered = `${payload}.invalid-signature`;
		const unsigned = payload;
		const expired = signedToken({
			userId,
			iat: Date.now() - 10_000,
			exp: Date.now() - 1,
		});

		expect(verifySessionToken(tampered)).toBeNull();
		expect(verifySessionToken(unsigned)).toBeNull();
		expect(verifySessionToken("not-a-token")).toBeNull();
		expect(verifySessionToken(expired)).toBeNull();
	});

	it("rejects token generation without a configured secret", () => {
		vi.stubGlobal("useRuntimeConfig", () => ({}));

		expect(() => generateSessionToken(userId)).toThrow(
			"JWT_SECRET must be configured",
		);
	});

	it("extracts a valid bearer user ID from request headers", () => {
		vi.stubGlobal("useRuntimeConfig", () => ({ JWT_SECRET: secret }));
		const token = generateSessionToken(userId);

		const event = {
			node: { req: { headers: { authorization: `Bearer ${token}` } } },
		};

		expect(getUserIdFromHeaders(event)).toBe(userId);
		expect(
			getUserIdFromHeaders({
				node: {
					req: {
						headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
					},
				},
			}),
		).toBe(userId);
		expect(
			getUserIdFromHeaders({
				node: { req: { headers: { authorization: `Bearer ${generateApiKey()}` } } },
			}),
		).toBeNull();
		expect(
			getUserIdFromHeaders({
				node: { req: { headers: { authorization: "Basic credentials" } } },
			}),
		).toBeNull();
	});

	it("hashes and masks API keys without exposing the secret", () => {
		const raw = generateApiKey();
		const hashed = hashApiKey(raw);
		const masked = maskApiKey(raw);

		expect(hashed).toMatch(/^[a-f0-9]{64}$/);
		expect(hashed).not.toContain(raw);
		expect(masked).toMatch(/^sk_[A-Za-z0-9_-]{4}…[A-Za-z0-9_-]{4}$/);
	});

	it("validates email and password strength", () => {
		expect(isValidEmail("user@example.com")).toBe(true);
		expect(isValidEmail("invalid")).toBe(false);
		expect(isValidPassword("StrongPass1").valid).toBe(true);
		expect(isValidPassword("weak").valid).toBe(false);
	});
});
