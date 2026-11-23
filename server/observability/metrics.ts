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
 * Lightweight in-process observability metrics (counters + bounded latency ring).
 *
 * Tracks redirect SLO percentiles (p50/p95/p99), L1/L2/negative cache hit ratios,
 * single-flight coalescing, DB fallback/errors, code-gen collision retries, and
 * async analytics buffer health.
 */

const LATENCY_RING_SIZE = 1024;

export interface LatencyPercentiles {
	readonly p50: number;
	readonly p95: number;
	readonly p99: number;
	readonly samples: number;
}

export interface MetricsSnapshot {
	readonly uptimeSeconds: number;
	readonly redirects: {
		readonly total: number;
		readonly status302: number;
		readonly status403: number;
		readonly status404: number;
		readonly status410: number;
		readonly status503: number;
		readonly latencyMs: LatencyPercentiles;
	};
	readonly cache: {
		readonly l1Hits: number;
		readonly l2Hits: number;
		readonly negativeHits: number;
		readonly misses: number;
		readonly hitRatio: number;
		readonly singleFlightCoalesced: number;
		readonly invalidations: number;
		readonly redisErrors: number;
		readonly dbFallbacks: number;
		readonly dbErrors: number;
	};
	readonly writes: {
		readonly linksCreated: number;
		readonly linksUpdated: number;
		readonly linksDeleted: number;
		readonly codeGenCollisions: number;
		readonly codeGenRetries: number;
	};
	readonly analytics: {
		readonly enqueued: number;
		readonly flushed: number;
		readonly dropped: number;
		readonly flushErrors: number;
	};
}

class MetricsRegistry {
	private startedAt = Date.now();
	private readonly latencies = new Float64Array(LATENCY_RING_SIZE);
	private latencyCount = 0;
	private latencyIndex = 0;

	public redirectsTotal = 0;
	public status302 = 0;
	public status403 = 0;
	public status404 = 0;
	public status410 = 0;
	public status503 = 0;

	public l1Hits = 0;
	public l2Hits = 0;
	public negativeHits = 0;
	public cacheMisses = 0;
	public singleFlightCoalesced = 0;
	public cacheInvalidations = 0;
	public redisErrors = 0;
	public dbFallbacks = 0;
	public dbErrors = 0;

	public linksCreated = 0;
	public linksUpdated = 0;
	public linksDeleted = 0;
	public codeGenCollisions = 0;
	public codeGenRetries = 0;

	public analyticsEnqueued = 0;
	public analyticsFlushed = 0;
	public analyticsDropped = 0;
	public analyticsFlushErrors = 0;

	recordRedirectLatency(durationMs: number): void {
		const clamped = Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : 0;
		this.latencies[this.latencyIndex] = clamped;
		this.latencyIndex = (this.latencyIndex + 1) % LATENCY_RING_SIZE;
		if (this.latencyCount < LATENCY_RING_SIZE) {
			this.latencyCount += 1;
		}
	}

	private computeLatencyPercentiles(): LatencyPercentiles {
		const count = this.latencyCount;
		if (count === 0) {
			return { p50: 0, p95: 0, p99: 0, samples: 0 };
		}
		const sorted = Float64Array.from(this.latencies.subarray(0, count)).sort();
		const pick = (q: number): number => {
			const idx = Math.min(count - 1, Math.max(0, Math.ceil(q * count) - 1));
			return Number((sorted[idx] ?? 0).toFixed(2));
		};
		return {
			p50: pick(0.5),
			p95: pick(0.95),
			p99: pick(0.99),
			samples: count,
		};
	}

	snapshot(): MetricsSnapshot {
		const hits = this.l1Hits + this.l2Hits + this.negativeHits;
		const lookups = hits + this.cacheMisses;
		const hitRatio = lookups > 0 ? Number((hits / lookups).toFixed(4)) : 0;

		return {
			uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
			redirects: {
				total: this.redirectsTotal,
				status302: this.status302,
				status403: this.status403,
				status404: this.status404,
				status410: this.status410,
				status503: this.status503,
				latencyMs: this.computeLatencyPercentiles(),
			},
			cache: {
				l1Hits: this.l1Hits,
				l2Hits: this.l2Hits,
				negativeHits: this.negativeHits,
				misses: this.cacheMisses,
				hitRatio,
				singleFlightCoalesced: this.singleFlightCoalesced,
				invalidations: this.cacheInvalidations,
				redisErrors: this.redisErrors,
				dbFallbacks: this.dbFallbacks,
				dbErrors: this.dbErrors,
			},
			writes: {
				linksCreated: this.linksCreated,
				linksUpdated: this.linksUpdated,
				linksDeleted: this.linksDeleted,
				codeGenCollisions: this.codeGenCollisions,
				codeGenRetries: this.codeGenRetries,
			},
			analytics: {
				enqueued: this.analyticsEnqueued,
				flushed: this.analyticsFlushed,
				dropped: this.analyticsDropped,
				flushErrors: this.analyticsFlushErrors,
			},
		};
	}

	reset(): void {
		this.startedAt = Date.now();
		this.latencies.fill(0);
		this.latencyCount = 0;
		this.latencyIndex = 0;
		this.redirectsTotal = 0;
		this.status302 = 0;
		this.status403 = 0;
		this.status404 = 0;
		this.status410 = 0;
		this.status503 = 0;
		this.l1Hits = 0;
		this.l2Hits = 0;
		this.negativeHits = 0;
		this.cacheMisses = 0;
		this.singleFlightCoalesced = 0;
		this.cacheInvalidations = 0;
		this.redisErrors = 0;
		this.dbFallbacks = 0;
		this.dbErrors = 0;
		this.linksCreated = 0;
		this.linksUpdated = 0;
		this.linksDeleted = 0;
		this.codeGenCollisions = 0;
		this.codeGenRetries = 0;
		this.analyticsEnqueued = 0;
		this.analyticsFlushed = 0;
		this.analyticsDropped = 0;
		this.analyticsFlushErrors = 0;
	}
}

export const metrics = new MetricsRegistry();
