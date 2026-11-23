import { beforeEach, describe, expect, it, vi } from "vitest";
import { metrics } from "../observability/metrics";
import {
	classifyUserAgent,
	ClickAnalyticsBuffer,
	sanitizeReferrer,
} from "./click-buffer";

describe("ClickAnalyticsBuffer (non-blocking, privacy-preserving, batched)", () => {
	beforeEach(() => {
		metrics.reset();
	});

	it("classifies user agents into coarse device classes", () => {
		expect(classifyUserAgent("Googlebot/2.1")).toBe("bot");
		expect(classifyUserAgent("curl/8.6.0")).toBe("bot");
		expect(
			classifyUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 Mobile)"),
		).toBe("mobile");
		expect(classifyUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0)")).toBe("tablet");
		expect(
			classifyUserAgent("Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0"),
		).toBe("desktop");
		expect(classifyUserAgent(null)).toBe("other");
	});

	it("strips query parameters and fragments from referrers", () => {
		expect(
			sanitizeReferrer("https://news.ycombinator.com/item?id=123&token=abc#top"),
		).toBe("https://news.ycombinator.com/item");
		expect(sanitizeReferrer("javascript:alert(1)")).toBeNull();
		expect(sanitizeReferrer("not-a-url")).toBeNull();
	});

	it("batches clicks into a single insert, strips raw IPs, and drops under backpressure", async () => {
		const persistBatch = vi.fn().mockResolvedValue({ error: null });
		const buffer = new ClickAnalyticsBuffer({
			maxBufferSize: 3,
			batchSize: 10,
			flushIntervalMs: 60_000,
			persistBatch,
		});

		expect(
			buffer.enqueue({
				shortLinkId: "id-1",
				userAgent: "Mozilla/5.0 Chrome/130",
				referrer: "https://example.org/post?secret=1",
				country: "US",
				city: "NYC",
			}),
		).toBe(true);
		expect(buffer.enqueue({ shortLinkId: "id-2" })).toBe(true);
		expect(buffer.enqueue({ shortLinkId: "id-3" })).toBe(true);
		// 4th event exceeds maxBufferSize=3 -> dropped cleanly without throwing
		expect(buffer.enqueue({ shortLinkId: "id-4" })).toBe(false);
		expect(metrics.analyticsDropped).toBe(1);

		const count = await buffer.flush();
		expect(count).toBe(3);
		expect(persistBatch).toHaveBeenCalledTimes(1);
		const rows = persistBatch.mock.calls[0]?.[0];
		expect(rows).toHaveLength(3);
		expect(rows[0]).toEqual({
			short_link_id: "id-1",
			user_agent: "[desktop] Mozilla/5.0 Chrome/130",
			referrer: "https://example.org/post",
			ip_address: null,
			country: "US",
			city: "NYC",
		});
		expect(metrics.analyticsFlushed).toBe(3);
		buffer.clear();
	});
});
