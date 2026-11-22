import * as S from "@effect/schema/Schema";
import { describe, expect, it } from "vitest";
import {
	ApiKeySchema,
	CustomAliasSchema,
	EmailSchema,
	PasswordSchema,
	ShortUrlCodeSchema,
	UUIDSchema,
	UrlSchema,
} from "./index";

describe("schema validation", () => {
	it("accepts only HTTP and HTTPS URLs", () => {
		expect(() => S.decodeSync(UrlSchema)("https://example.com")).not.toThrow();
		expect(() => S.decodeSync(UrlSchema)("ftp://example.com")).toThrow();
		expect(() => S.decodeSync(UrlSchema)("not a URL")).toThrow();
	});

	it("validates aliases and short codes", () => {
		expect(() => S.decodeSync(CustomAliasSchema)("my_alias-1")).not.toThrow();
		expect(() => S.decodeSync(CustomAliasSchema)("bad alias")).toThrow();
		expect(() => S.decodeSync(ShortUrlCodeSchema)("abc123")).not.toThrow();
		expect(() => S.decodeSync(ShortUrlCodeSchema)("abc12")).toThrow();
	});

	it("validates UUID, email, password, and API-key formats", () => {
		expect(() =>
			S.decodeSync(UUIDSchema)("550e8400-e29b-41d4-a716-446655440000"),
		).not.toThrow();
		expect(() => S.decodeSync(UUIDSchema)("550e8400-e29b-11d4-a716-446655440000")).toThrow();
		expect(() => S.decodeSync(EmailSchema)("user@example.com")).not.toThrow();
		expect(() => S.decodeSync(EmailSchema)("user@localhost")).toThrow();
		expect(() => S.decodeSync(PasswordSchema)("StrongPass1")).not.toThrow();
		expect(() => S.decodeSync(PasswordSchema)("lowercase1")).toThrow();
		expect(() => S.decodeSync(ApiKeySchema)("sk_" + "a".repeat(43))).not.toThrow();
		expect(() => S.decodeSync(ApiKeySchema)("sk_short")).toThrow();
	});
});
