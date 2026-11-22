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

import { executeQuery } from "../utils/graphql";
import type { LinkHealthScope } from "./types";
import { normalizeLinkUrl } from "./url";

const GET_ACTIVE_LINK_URLS = `
  query GetActiveLinkUrls($limit: Int!) {
    short_links(
      where: { is_active: { _eq: true } }
      order_by: { created_at: desc }
      limit: $limit
    ) {
      original_url
    }
  }
`;

/**
 * Load canonical destination URLs of existing active short links from Hasura.
 * Fixed collection only — never accepts caller-supplied URLs.
 */
export async function loadLinkCatalog(
	scope: LinkHealthScope,
): Promise<string[]> {
	const limit = scope === "public" ? 100 : 500;
	const { data, error } = await executeQuery<{
		short_links: Array<{ original_url: string }>;
	}>(GET_ACTIVE_LINK_URLS, { limit });

	if (error || !data) {
		return [];
	}

	const urls: string[] = [];
	for (const row of data.short_links) {
		const normalized = normalizeLinkUrl(row.original_url);
		if (normalized) urls.push(normalized);
	}
	return urls;
}
