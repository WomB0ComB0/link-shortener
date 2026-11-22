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

/** Cached reachability of existing shortened link destinations. */
export type LinkHealthScope = "public" | "all";

export type LinkHealthStatus =
	| "reachable"
	| "unavailable"
	| "temporary"
	| "unknown";

export interface LinkHealthEntry {
	readonly status: LinkHealthStatus;
	readonly checkedAt: string;
}

export interface LinkHealthResponse {
	readonly links: Record<string, LinkHealthEntry>;
}

export interface LinkObservation {
	readonly kind: "reachable" | "missing" | "temporary" | "unknown";
	readonly httpStatus?: number;
}
