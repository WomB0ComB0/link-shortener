import { Schema as S } from "effect";
import { describe, expect, it } from "vitest";
import {
	formatValidationErrors,
	runEffect,
	validateAsync,
	validateRequest,
	validateSync,
} from "./validation";
import { EmailSchema } from "../schemas";

describe("request validation utilities", () => {
	it("decodes valid requests as Effects", async () => {
		const result = await runEffect(
			validateRequest(EmailSchema, "user@example.com"),
		);

		expect(result).toBe("user@example.com");
	});

	it("throws H3-compatible errors for invalid sync input", () => {
		expect(() => validateSync(EmailSchema, "invalid")).toThrow();
		expect(() => validateSync(EmailSchema, "invalid", "Email is invalid")).toThrow(
			"Email is invalid",
		);
	});

	it("validates asynchronous input and formats parse errors", async () => {
		await expect(validateAsync(EmailSchema, "invalid")).rejects.toThrow();

		try {
			S.decodeSync(EmailSchema)("invalid");
		} catch (error) {
			const formatted = formatValidationErrors(error as never);
			expect(formatted[0]?.field).toBe("unknown");
			expect(formatted[0]?.message).toContain("valid email address");
		}
	});
});
