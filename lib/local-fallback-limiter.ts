/**
 * Copyright 2026 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Bounded In-Process Sliding-Window Counter Fallback Limiter.
 *
 * Implements the weighted two-window sliding counter algorithm (avoids
 * fixed-window boundary bursts with O(1) memory per key) with strict
 * cardinality cap (`maxEntries`, LRU eviction).
 *
 * Used automatically when the shared Redis store times out, errors, or is
 * circuit-broken so sensitive routes (`auth`, `create`, `verify`) never
 * degrade into completely unthrottled traffic.
 */

export interface LocalLimitResult {
	readonly success: boolean;
	readonly limit: number;
	readonly remaining: number;
	readonly reset: number;
}

interface WindowEntry {
	windowStart: number;
	prevCount: number;
	currCount: number;
}

export class LocalSlidingWindowLimiter {
	private readonly buckets = new Map<string, WindowEntry>();
	private readonly maxEntries: number;

	constructor(maxEntries = 2048) {
		this.maxEntries = maxEntries;
	}

	/**
	 * Evaluate and consume `cost` (default 1) against `key` for `(limit, windowMs)`.
	 */
	consume(
		key: string,
		limit: number,
		windowMs: number,
		nowMs = Date.now(),
		cost = 1,
	): LocalLimitResult {
		const effectiveLimit = Math.max(1, limit);
		const currentWindowStart = Math.floor(nowMs / windowMs) * windowMs;
		const reset = currentWindowStart + windowMs;

		const existing = this.buckets.get(key);
		let entry: WindowEntry;

		if (!existing) {
			entry = { windowStart: currentWindowStart, prevCount: 0, currCount: 0 };
		} else if (existing.windowStart === currentWindowStart) {
			entry = existing;
			// Refresh LRU position
			this.buckets.delete(key);
		} else if (existing.windowStart === currentWindowStart - windowMs) {
			entry = {
				windowStart: currentWindowStart,
				prevCount: existing.currCount,
				currCount: 0,
			};
			this.buckets.delete(key);
		} else {
			entry = { windowStart: currentWindowStart, prevCount: 0, currCount: 0 };
			this.buckets.delete(key);
		}

		const elapsed = Math.max(0, nowMs - currentWindowStart);
		const prevWeight = Math.max(0, 1 - elapsed / windowMs);
		const estimatedBefore = entry.prevCount * prevWeight + entry.currCount;

		if (estimatedBefore + cost > effectiveLimit) {
			this.insertBounded(key, entry);
			return {
				success: false,
				limit: effectiveLimit,
				remaining: 0,
				reset,
			};
		}

		entry.currCount += cost;
		this.insertBounded(key, entry);

		const remaining = Math.max(
			0,
			Math.floor(effectiveLimit - (entry.prevCount * prevWeight + entry.currCount)),
		);

		return {
			success: true,
			limit: effectiveLimit,
			remaining,
			reset,
		};
	}

	private insertBounded(key: string, entry: WindowEntry): void {
		if (this.buckets.size >= this.maxEntries) {
			const oldestKey = this.buckets.keys().next().value;
			if (oldestKey !== undefined) {
				this.buckets.delete(oldestKey);
			}
		}
		this.buckets.set(key, entry);
	}

	get size(): number {
		return this.buckets.size;
	}

	clear(): void {
		this.buckets.clear();
	}
}
