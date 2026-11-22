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

import { onMounted } from "vue";
import { useFetcher } from "./use-fetcher";

export type LinkHealthStatus =
	| "reachable"
	| "unavailable"
	| "temporary"
	| "unknown";

export interface LinkHealthEntry {
	readonly status: LinkHealthStatus;
	readonly checkedAt: string;
}

/** Browser-safe canonicalization matching server/link-health/url.ts */
export function normalizeHealthUrl(value: unknown): string | null {
	if (
		typeof value !== "string" ||
		value.length > 2048 ||
		/[\u0000-\u001f\u007f\\]/u.test(value)
	) {
		return null;
	}
	const input = value.trim();
	if (!/^https?:\/\//iu.test(input)) return null;
	try {
		const url = new URL(input);
		if (!["http:", "https:"].includes(url.protocol) || url.port) return null;
		if (url.username !== "" || url.password !== "") return null;
		url.hash = "";
		return url.href.length <= 2048 ? url.href : null;
	} catch {
		return null;
	}
}

let inFlight: Promise<void> | null = null;

/**
 * Shared client link-health store (one fetch per session across all LinkCards).
 */
export function useLinkHealth() {
	const entries = useState<Record<string, LinkHealthEntry>>(
		"link_health_entries",
		() => ({}),
	);
	const loaded = useState<boolean>("link_health_loaded", () => false);
	const { get: fetchGet } = useFetcher();

	async function load(force = false): Promise<void> {
		if (!import.meta.client) return;
		if (loaded.value && !force) return;
		if (inFlight && !force) return inFlight;

		inFlight = (async () => {
			try {
				const res = await fetchGet<{ links?: Record<string, LinkHealthEntry> }>(
					"/api/links/health",
					{ retries: 0, timeout: 5000 },
					{ scope: "public" },
				);
				if (res && typeof res.links === "object" && res.links !== null) {
					entries.value = res.links;
				}
				loaded.value = true;
			} catch {
				// Supplementary indicator only: never disrupt link rendering
			} finally {
				inFlight = null;
			}
		})();

		return inFlight;
	}

	onMounted(() => {
		void load();
	});

	function getEntry(rawUrl: string | null | undefined): {
		url: string | null;
		entry: LinkHealthEntry | null;
	} {
		const url = normalizeHealthUrl(rawUrl);
		if (!url) return { url: null, entry: null };
		const entry = entries.value[url] ?? null;
		return { url, entry };
	}

	return {
		entries,
		loaded,
		load,
		getEntry,
	};
}
