import { describe, expect, it, vi } from "vitest";
import {
	generateApiKey,
	generateShortCode,
	hashPassword,
	isValidAlias,
	isValidEmail,
	isValidUrl,
	isValidUUID,
	verifyMasterPassword,
} from "./helpers";

describe("server helpers", () => {
	it("generates short codes with the requested format", () => {
		const code = generateShortCode(12);

		expect(code).toMatch(/^[a-zA-Z0-9]{12}$/);
	});

	it("generates API keys with the documented format", () => {
		expect(generateApiKey()).toMatch(/^sk_[A-Za-z0-9_-]{43}$/);
	});

	it("delegates validation to the shared schemas", () => {
		expect(isValidUrl("https://example.com/path")).toBe(true);
		expect(isValidUrl("javascript:alert(1)")).toBe(false);
		expect(isValidAlias("my-link_1")).toBe(true);
		expect(isValidAlias("bad alias")).toBe(false);
		expect(isValidEmail("user@example.com")).toBe(true);
		expect(isValidEmail("not-an-email")).toBe(false);
		expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
		expect(isValidUUID("not-a-uuid")).toBe(false);
	});

	it("hashes passwords deterministically", () => {
		expect(hashPassword("password")).toBe(
			"5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
		);
	});

	it("verifies the configured master password", () => {
		vi.stubGlobal("useRuntimeConfig", () => ({
			MASTER_PASSWORD_HASH: hashPassword("master-password"),
		}));

		expect(verifyMasterPassword("master-password")).toBe(true);
		expect(verifyMasterPassword("wrong-password")).toBe(false);
	});

	it("normalizes casing and whitespace on configured master password hash", () => {
		vi.stubGlobal("useRuntimeConfig", () => ({
			MASTER_PASSWORD_HASH: `  ${hashPassword("master-password").toUpperCase()}  `,
		}));

		expect(verifyMasterPassword("master-password")).toBe(true);
	});

	it("fails explicitly when the master password is not configured", () => {
		vi.stubGlobal("useRuntimeConfig", () => ({}));

		expect(() => verifyMasterPassword("anything")).toThrow(
			"Master password not configured",
		);
	});
});
