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
 * Non-blocking, bounded, batched click analytics pipeline.
 *
 * Design principles:
 * - "Redirect first. Analytics can happen asynchronously."
 * - Bounded in-process queue (`MAX_BUFFER_SIZE`): if full under viral load,
 *   new events are dropped instead of causing OOM or stalling `302` responses.
 * - Privacy by default: raw IP addresses are NOT persisted long-term (`ip_address: null`);
 *   only coarse geo (`country`, `city`), sanitized referrer (query/hash stripped),
 *   and normalized UA class are recorded.
 * - Flushes in batches via a single `insert_clicks(objects: ...)` GraphQL mutation.
 */

import { CREATE_CLICKS_BATCH } from "../../lib/graphql/operations";
import { metrics } from "../observability/metrics";
import { executeMutation } from "../utils/graphql";

export type UserAgentClass = "bot" | "mobile" | "tablet" | "desktop" | "other";

export interface ClickEventInput {
	readonly shortLinkId: string;
	readonly userAgent?: string | null;
	readonly referrer?: string | null;
	readonly country?: string | null;
	readonly city?: string | null;
}

export interface ClickInsertRow {
	readonly short_link_id: string;
	readonly user_agent: string | null;
	readonly referrer: string | null;
	readonly ip_address: null;
	readonly country: string | null;
	readonly city: string | null;
}

export interface ClickBufferOptions {
	readonly maxBufferSize?: number;
	readonly batchSize?: number;
	readonly flushIntervalMs?: number;
	readonly persistBatch?: (
		rows: readonly ClickInsertRow[],
	) => Promise<{ error: Error | null }>;
}

const DEFAULT_MAX_BUFFER_SIZE = 500;
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_FLUSH_INTERVAL_MS = 2_000;
const MAX_UA_LENGTH = 256;
const MAX_REFERRER_LENGTH = 512;

export function classifyUserAgent(ua: string | null | undefined): UserAgentClass {
	if (!ua) return "other";
	const lower = ua.toLowerCase();
	if (
		/bot|crawler|spider|slurp|curl|wget|python-requests|headless|lighthouse|monitoring|uptime/i.test(
			lower,
		)
	) {
		return "bot";
	}
	if (/ipad|tablet|playbook|silk/i.test(lower)) {
		return "tablet";
	}
	if (/mobile|iphone|ipod|android.*mobile|windows phone/i.test(lower)) {
		return "mobile";
	}
	if (/mozilla|chrome|safari|firefox|edge|opera|webkit/i.test(lower)) {
		return "desktop";
	}
	return "other";
}

/**
 * Strip query strings and fragments from referrers to avoid storing tokens/PII.
 */
export function sanitizeReferrer(referrer: string | null | undefined): string | null {
	if (!referrer) return null;
	try {
		const parsed = new URL(referrer);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return null;
		}
		return `${parsed.origin}${parsed.pathname}`.slice(0, MAX_REFERRER_LENGTH);
	} catch {
		return null;
	}
}

function sanitizeUserAgent(ua: string | null | undefined): string | null {
	if (!ua) return null;
	const trimmed = ua.trim();
	if (!trimmed) return null;
	const cls = classifyUserAgent(trimmed);
	return `[${cls}] ${trimmed}`.slice(0, MAX_UA_LENGTH);
}

export class ClickAnalyticsBuffer {
	private readonly queue: ClickInsertRow[] = [];
	private timer: ReturnType<typeof setTimeout> | null = null;
	private flushing = false;

	private readonly maxBufferSize: number;
	private readonly batchSize: number;
	private readonly flushIntervalMs: number;
	private readonly persistBatch: (
		rows: readonly ClickInsertRow[],
	) => Promise<{ error: Error | null }>;

	constructor(options: ClickBufferOptions = {}) {
		this.maxBufferSize = options.maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE;
		this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
		this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
		this.persistBatch =
			options.persistBatch ??
			(async (rows) => {
				const { error } = await executeMutation(CREATE_CLICKS_BATCH, {
					objects: rows,
				});
				return { error };
			});
	}

	/**
	 * Enqueue a click event synchronously without blocking the redirect response.
	 * Returns `false` if dropped due to backpressure.
	 */
	enqueue(input: ClickEventInput): boolean {
		if (this.queue.length >= this.maxBufferSize) {
			metrics.analyticsDropped += 1;
			return false;
		}

		this.queue.push({
			short_link_id: input.shortLinkId,
			user_agent: sanitizeUserAgent(input.userAgent),
			referrer: sanitizeReferrer(input.referrer),
			ip_address: null,
			country: input.country || null,
			city: input.city || null,
		});
		metrics.analyticsEnqueued += 1;

		if (this.queue.length >= this.batchSize) {
			void this.flush();
		} else {
			this.scheduleFlush();
		}

		return true;
	}

	private scheduleFlush(): void {
		if (this.timer !== null) return;
		this.timer = setTimeout(() => {
			this.timer = null;
			void this.flush();
		}, this.flushIntervalMs);
		if (typeof this.timer === "object" && "unref" in this.timer) {
			this.timer.unref();
		}
	}

	async flush(): Promise<number> {
		if (this.flushing || this.queue.length === 0) return 0;
		this.flushing = true;

		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null;
		}

		let totalFlushed = 0;
		try {
			while (this.queue.length > 0) {
				const batch = this.queue.splice(0, this.batchSize);
				const { error } = await this.persistBatch(batch);
				if (error) {
					metrics.analyticsFlushErrors += 1;
					console.error("[Analytics] Failed to flush click batch:", error);
					// Never re-enqueue unboundedly; drop failed batch to protect memory.
					break;
				}
				totalFlushed += batch.length;
				metrics.analyticsFlushed += batch.length;
			}
		} catch (error) {
			metrics.analyticsFlushErrors += 1;
			console.error("[Analytics] Unexpected error flushing clicks:", error);
		} finally {
			this.flushing = false;
			if (this.queue.length > 0) {
				this.scheduleFlush();
			}
		}

		return totalFlushed;
	}

	get pendingCount(): number {
		return this.queue.length;
	}

	clear(): void {
		this.queue.length = 0;
		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		this.flushing = false;
	}
}

export const clickBuffer = new ClickAnalyticsBuffer();

export function enqueueClick(input: ClickEventInput): boolean {
	return clickBuffer.enqueue(input);
}
