import { describe, expect, it } from "vitest";
import { Redacted } from "./redacted";

describe("Redacted", () => {
	it("hides values in string, JSON, and inspect representations", () => {
		const value = Redacted.make("secret");

		expect(value.getValue()).toBe("secret");
		expect(value.toString()).toBe("[REDACTED]");
		expect(value.toJSON()).toBe("[REDACTED]");
		expect(value.inspect()).toBe("[REDACTED]");
		expect(JSON.stringify(value)).toBe('"[REDACTED]"');
	});

	it("supports equality and type checks without exposing values", () => {
		const first = Redacted.make("secret");
		const same = Redacted.make("secret");
		const different = Redacted.make("other");

		expect(first.equals(same)).toBe(true);
		expect(first.equals(different)).toBe(false);
		expect(Redacted.isRedacted(first)).toBe(true);
		expect(Redacted.isRedacted("secret")).toBe(false);
		expect(() => Redacted.make(null)).toThrow(
			"Value cannot be null or undefined",
		);
	});
});
