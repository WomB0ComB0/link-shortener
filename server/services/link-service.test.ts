import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import {
	AuthenticationError,
	DatabaseError,
	NotFoundError,
	RateLimitError,
	ValidationError,
	createAndRecordLink,
	createShortLinkEffect,
} from "./link-service";

describe("link service effects", () => {
	it("creates a link with a generated short code", async () => {
		const result = await Effect.runPromise(
			createShortLinkEffect({ originalUrl: "https://example.com" }),
		);

		expect(result.id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		);
		expect(result.shortUrl).toMatch(/^[A-Za-z0-9]{6}$/);
		expect(result.originalUrl).toBe("https://example.com");
	});

	it("preserves valid custom aliases", async () => {
		const result = await Effect.runPromise(
			createShortLinkEffect({
				originalUrl: "https://example.com",
				customAlias: "my-link",
			}),
		);

		expect(result.shortUrl).toBe("my-link");
	});

	it("returns validation failures for invalid input", async () => {
		const invalidUrl = await Effect.runPromiseExit(
			createShortLinkEffect({ originalUrl: "not a URL" }),
		);
		const invalidAlias = await Effect.runPromiseExit(
			createShortLinkEffect({
				originalUrl: "https://example.com",
				customAlias: "bad alias",
			}),
		);

		expect(Exit.isFailure(invalidUrl)).toBe(true);
		expect(Exit.isFailure(invalidAlias)).toBe(true);
	});

	it("composes link creation and click recording", async () => {
		const result = await Effect.runPromise(
			createAndRecordLink({
				originalUrl: "https://example.com",
				ipAddress: "127.0.0.1",
				userAgent: "test",
			}),
		);

		expect(result.originalUrl).toBe("https://example.com");
	});

	it("keeps domain error types distinguishable", () => {
		expect(new ValidationError("bad")._tag).toBe("ValidationError");
		expect(new DatabaseError("down")._tag).toBe("DatabaseError");
		expect(new NotFoundError("missing", "id")._tag).toBe("NotFoundError");
		expect(new AuthenticationError("unauthorized")._tag).toBe(
			"AuthenticationError",
		);
		expect(new RateLimitError("slow down", Date.now())._tag).toBe(
			"RateLimitError",
		);
	});
});
