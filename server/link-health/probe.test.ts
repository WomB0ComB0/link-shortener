import { describe, expect, it, vi } from "vitest";
import { createLinkProbe } from "./probe";
import { normalizeLinkUrl } from "./url";

describe("link-health URL normalizer and SSRF-safe probe", () => {
	it("normalizes valid HTTP(S) URLs and strips hashes while rejecting unsafe inputs", () => {
		expect(normalizeLinkUrl("https://mikeodnis.dev/projects#top")).toBe(
			"https://mikeodnis.dev/projects",
		);
		expect(normalizeLinkUrl("https://user:pass@example.com/")).toBeNull();
		expect(normalizeLinkUrl("https://example.com:8443/")).toBeNull();
		expect(normalizeLinkUrl("javascript:alert(1)")).toBeNull();
		expect(normalizeLinkUrl("https://example.com/\nfoo")).toBeNull();
	});

	it("blocks hosts resolving to private or mixed private/public IPs without making HTTP requests", async () => {
		const request = vi.fn();
		const probe = createLinkProbe({
			resolve: vi.fn().mockResolvedValue(["93.184.216.34", "169.254.169.254"]),
			request,
		});

		await expect(probe("https://rebind.example/")).resolves.toEqual({
			kind: "unknown",
		});
		expect(request).not.toHaveBeenCalled();
	});

	it("falls back from HEAD to GET on 405 and follows safe redirects", async () => {
		const resolve = vi.fn().mockResolvedValue(["93.184.216.34"]);
		const request = vi
			.fn()
			.mockResolvedValueOnce({ status: 405 })
			.mockResolvedValueOnce({ status: 301, location: "https://example.com/final" })
			.mockResolvedValueOnce({ status: 200 });

		const probe = createLinkProbe({ resolve, request });
		const result = await probe("https://example.com/start");

		expect(result).toEqual({ kind: "reachable", httpStatus: 200 });
		expect(request).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ method: "HEAD" }),
		);
		expect(request).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ method: "GET" }),
		);
	});

	it("classifies 404/410 as missing, 403 as reachable, and 503 as temporary", async () => {
		const resolve = vi.fn().mockResolvedValue(["93.184.216.34"]);
		const makeProbe = (status: number) =>
			createLinkProbe({
				resolve,
				request: vi.fn().mockResolvedValue({ status }),
			});

		await expect(makeProbe(404)("https://example.com/gone")).resolves.toEqual({
			kind: "missing",
			httpStatus: 404,
		});
		await expect(makeProbe(410)("https://example.com/gone")).resolves.toEqual({
			kind: "missing",
			httpStatus: 410,
		});
		await expect(makeProbe(403)("https://example.com/gated")).resolves.toEqual({
			kind: "reachable",
			httpStatus: 403,
		});
		await expect(makeProbe(503)("https://example.com/down")).resolves.toEqual({
			kind: "temporary",
			httpStatus: 503,
		});
	});

	it("returns unknown instead of temporary when the deadline timer fires far overdue (container freeze)", async () => {
		vi.useFakeTimers();
		try {
			const probe = createLinkProbe({
				resolve: vi.fn().mockResolvedValue(["93.184.216.34"]),
				request: vi.fn(() => new Promise(() => {})),
			});

			const start = Date.now();
			const promise = probe("https://example.com/frozen");
			// Simulate the container waking 10s past the 5s deadline
			vi.setSystemTime(start + 15_000);
			await vi.advanceTimersByTimeAsync(5000);

			await expect(promise).resolves.toEqual({ kind: "unknown" });
		} finally {
			vi.useRealTimers();
		}
	});
});
