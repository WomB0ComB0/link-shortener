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

import { type LinkRecord, nextRecord, publicEntry, readRecord } from "./state";
import type {
	LinkHealthResponse,
	LinkHealthScope,
	LinkObservation,
} from "./types";

export interface LinkHealthStore {
	read(scope: LinkHealthScope): Promise<unknown>;
	/** Global 30s distributed lease; retained as cooldown after batch finishes. */
	acquire(): Promise<string | null>;
	/** Fenced save: writes only while `lease` still owns the lock. */
	write(
		scope: LinkHealthScope,
		records: Record<string, LinkRecord>,
		lease: string,
	): Promise<void>;
}

export interface LinkHealthDependencies {
	readonly store: LinkHealthStore | null;
	readonly catalog: (scope: LinkHealthScope) => Promise<string[]>;
	readonly probe: (url: string) => Promise<LinkObservation>;
	readonly now?: () => number;
	readonly batchSize?: number;
	readonly report?: (error: unknown) => void;
}

function recordsFor(
	raw: unknown,
	urls: readonly string[],
): Record<string, LinkRecord> {
	const source =
		raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
	const records: Record<string, LinkRecord> = {};
	for (const url of urls) {
		const record = readRecord(source[url]);
		if (record) records[url] = record;
	}
	return records;
}

/**
 * Link-health coordinator matching portfolio's architecture:
 * - `read(scope)` is pure cache-read (never blocks on probes).
 * - `refresh(scope)` probes a bounded batch of due catalog URLs under a fenced lease.
 * - Never accepts arbitrary caller-supplied URLs (cannot be abused as an SSRF oracle).
 */
export function createLinkHealthService({
	store,
	catalog,
	probe,
	now = Date.now,
	batchSize = 8,
	report = () => undefined,
}: LinkHealthDependencies) {
	const urlsFor = async (scope: LinkHealthScope) =>
		[...new Set(await catalog(scope))].slice(0, 500);

	return {
		async read(scope: LinkHealthScope): Promise<LinkHealthResponse> {
			if (!store) return { links: {} };
			try {
				const urls = await urlsFor(scope);
				const records = recordsFor(await store.read(scope), urls);
				const links: Record<string, { status: LinkRecord["status"]; checkedAt: string }> = {};
				const time = now();
				for (const [url, record] of Object.entries(records)) {
					const entry = publicEntry(record, time);
					if (entry) links[url] = entry;
				}
				return { links };
			} catch (error) {
				report(error);
				return { links: {} };
			}
		},

		async refresh(scope: LinkHealthScope): Promise<number> {
			if (!store) return 0;
			try {
				const urls = await urlsFor(scope);
				let records = recordsFor(await store.read(scope), urls);
				const due = (url: string) =>
					!records[url] || records[url].nextCheckAt <= now();
				if (!urls.some(due)) return 0;

				const deadline = now() + 24_000;
				const lease = await store.acquire();
				if (!lease) return 0;

				// Re-read after acquiring lease in case another worker saved fresh data
				records = recordsFor(await store.read(scope), urls);
				const selected = urls
					.filter(due)
					.sort((a, b) => {
						// Prioritize confirming suspected missing URLs promptly, then oldest/unprobed
						const priority = (url: string) =>
							records[url]?.kind === "missing" &&
							records[url]?.status === "unknown"
								? 0
								: 1;
						return (
							priority(a) - priority(b) ||
							(records[a]?.checkedAt ?? 0) - (records[b]?.checkedAt ?? 0)
						);
					})
					.slice(0, batchSize);

				if (selected.length === 0) return 0;

				let probed = 0;
				for (let index = 0; index < selected.length; index += 2) {
					if (now() >= deadline) break;
					await Promise.all(
						selected.slice(index, index + 2).map(async (url) => {
							let observation: LinkObservation;
							try {
								observation = await probe(url);
							} catch (error) {
								report(error);
								observation = { kind: "unknown" };
							}
							records[url] = nextRecord(records[url], observation, now());
							probed += 1;
						}),
					);
				}

				await store.write(scope, records, lease);
				return probed;
			} catch (error) {
				report(error);
				return 0;
			}
		},
	};
}
