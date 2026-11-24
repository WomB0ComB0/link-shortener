import { Effect, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";
import {
	FetcherError,
	ValidationError,
	createApiResponseSchema,
	createPaginatedSchema,
} from "./fetcher";

describe("fetcher utilities", () => {
	it("preserves useful HTTP error context", () => {
		const error = new FetcherError("Not found", "/api/items", 404, {
			error: "missing",
		}, 1);

		expect(error.name).toBe("FetcherError");
		expect(error.toString()).toContain("Status: 404");
		expect(error.url).toBe("/api/items");
		expect(error.responseData).toEqual({ error: "missing" });
	});

	it("preserves response validation context and callbacks", () => {
		const onError = vi.fn();
		const error = new ValidationError(
			"Response validation failed",
			"/api/items",
			"data: expected number",
			{ data: "wrong" },
			2,
		);

		onError(error);
		expect(onError).toHaveBeenCalledWith(error);
		expect(error.getProblemsString()).toContain("expected number");
		expect(error.toString()).toContain("Attempt: 2");
	});

	it("creates schemas for paginated and wrapped API responses", async () => {
		const item = Schema.Struct({ id: Schema.Number });
		const page = createPaginatedSchema(item);
		const response = createApiResponseSchema(item);

		await expect(
			Effect.runPromise(
				Schema.decodeUnknownEffect(page)({
					data: [{ id: 1 }],
					pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
				}),
			),
		).resolves.toEqual({
			data: [{ id: 1 }],
			pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
		});
		await expect(
			Effect.runPromise(
				Schema.decodeUnknownEffect(response)({
					success: true,
					data: { id: 1 },
					message: "ok",
				}),
			),
		).resolves.toEqual({ success: true, data: { id: 1 }, message: "ok" });
	});
});
