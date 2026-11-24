import { describe, expect, it } from "vitest";
import { LocalSlidingWindowLimiter } from "./local-fallback-limiter";

describe("LocalSlidingWindowLimiter (bounded weighted sliding-window counter)", () => {
	it("enforces limit accurately and prevents fixed-window boundary bursts", () => {
		const limiter = new LocalSlidingWindowLimiter(100);
		const windowMs = 10_000;

		// Send 4 requests near the end of window 1 (t = 19_000, 90% through [10_000, 20_000))
		for (let i = 0; i < 4; i++) {
			expect(limiter.consume("auth:ip:1", 4, windowMs, 19_000).success).toBe(
				true,
			);
		}
		expect(limiter.consume("auth:ip:1", 4, windowMs, 19_500).success).toBe(
			false,
		);

		// Immediately after window boundary (t = 20_500 -> 95% weight on prev window of 4 = 3.8)
		// Fixed-window would allow 4 more (8 in 1s!); sliding-window counter blocks immediately!
		const boundaryAttempt = limiter.consume("auth:ip:1", 4, windowMs, 20_500);
		expect(boundaryAttempt.success).toBe(false);
		expect(boundaryAttempt.remaining).toBe(0);

		// Halfway through next window (t = 25_000 -> 50% weight on prev 4 = 2.0 -> 2 remaining)
		expect(limiter.consume("auth:ip:1", 4, windowMs, 25_000).success).toBe(
			true,
		);
		expect(limiter.consume("auth:ip:1", 4, windowMs, 25_000).success).toBe(
			true,
		);
		expect(limiter.consume("auth:ip:1", 4, windowMs, 25_000).success).toBe(
			false,
		);
	});

	it("enforces maxEntries LRU cardinality bound", () => {
		const limiter = new LocalSlidingWindowLimiter(3);
		limiter.consume("k1", 5, 60_000, 1000);
		limiter.consume("k2", 5, 60_000, 1000);
		limiter.consume("k3", 5, 60_000, 1000);
		limiter.consume("k4", 5, 60_000, 1000);
		expect(limiter.size).toBe(3);
	});
});
