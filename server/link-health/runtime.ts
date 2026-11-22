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

import { loadLinkCatalog } from "./catalog";
import { probeLink } from "./probe";
import { createLinkHealthService } from "./service";
import { connectLinkHealthStore } from "./store";
import type { LinkHealthResponse, LinkHealthScope } from "./types";

let service: ReturnType<typeof createLinkHealthService> | undefined;

function getService() {
	if (!service) {
		service = createLinkHealthService({
			store: connectLinkHealthStore(
				process.env.UPSTASH_REDIS_REST_URL,
				process.env.UPSTASH_REDIS_REST_TOKEN,
			),
			catalog: loadLinkCatalog,
			probe: probeLink,
			report: (error) => console.error("[link-health]", error),
		});
	}
	return service;
}

export function readLinkHealth(
	scope: LinkHealthScope = "public",
): Promise<LinkHealthResponse> {
	return getService().read(scope);
}

export function refreshLinkHealth(
	scope: LinkHealthScope = "public",
): Promise<number> {
	return getService().refresh(scope);
}
