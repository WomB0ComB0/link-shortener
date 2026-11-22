/**
 * Copyright 2025 Mike Odnis
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

import { defineEventHandler, getQuery } from "h3";
import { executeQuery } from "../../../server/utils/graphql";

const GET_PUBLIC_LINKS = `
  query GetPublicLinks($limit: Int!) {
    short_links(
      where: {is_active: {_eq: true}}
      order_by: {created_at: desc}
      limit: $limit
    ) {
      id
      short_url
      original_url
      custom_alias
      created_at
      clicks_aggregate {
        aggregate {
          count
        }
      }
    }
  }
`;

const GET_PUBLIC_LINKS_FLAT = `
  query GetPublicLinksFlat($limit: Int!) {
    short_links(
      where: {is_active: {_eq: true}}
      order_by: {created_at: desc}
      limit: $limit
    ) {
      id
      short_url
      original_url
      custom_alias
      created_at
    }
  }
`;

const GET_CLICKS_FOR_LINKS = `
  query GetClicksForLinks($ids: [uuid!]!) {
    clicks(where: {short_link_id: {_in: $ids}}) {
      short_link_id
    }
  }
`;

const isMissingRelationshipError = (error: unknown): boolean =>
	error instanceof Error && error.message.includes("clicks_aggregate");

const MIN_PUBLIC_LIMIT = 1;
const DEFAULT_PUBLIC_LIMIT = 12;
const MAX_PUBLIC_LIMIT = 50;

export default defineEventHandler(async (event) => {
	const query = getQuery(event);
	const rawLimit = Number(query.limit);
	const limit =
		Number.isFinite(rawLimit) && rawLimit > 0
			? Math.min(Math.max(Math.trunc(rawLimit), MIN_PUBLIC_LIMIT), MAX_PUBLIC_LIMIT)
			: DEFAULT_PUBLIC_LIMIT;

	const { data, error } = await executeQuery<{
		short_links: Array<{
			id: string;
			short_url: string;
			original_url: string;
			custom_alias: string | null;
			created_at: string;
			clicks_aggregate: {
				aggregate: {
					count: number;
				};
			};
		}>;
	}>(GET_PUBLIC_LINKS, { limit });

	if (!error && data) {
		return data.short_links.map((link) => ({
			id: link.id,
			shortUrl: link.short_url,
			originalUrl: link.original_url,
			customAlias: link.custom_alias,
			createdAt: link.created_at,
			totalClicks: link.clicks_aggregate.aggregate.count,
		}));
	}

	if (!isMissingRelationshipError(error)) {
		return [];
	}

	const { data: flatData, error: flatError } = await executeQuery<{
		short_links: Array<{
			id: string;
			short_url: string;
			original_url: string;
			custom_alias: string | null;
			created_at: string;
		}>;
	}>(GET_PUBLIC_LINKS_FLAT, { limit });

	if (flatError || !flatData) {
		return [];
	}

	const ids = flatData.short_links.map((l) => l.id);
	const counts = new Map<string, number>();

	if (ids.length > 0) {
		const { data: clicksData } = await executeQuery<{
			clicks: Array<{ short_link_id: string }>;
		}>(GET_CLICKS_FOR_LINKS, { ids });
		for (const click of clicksData?.clicks ?? []) {
			counts.set(click.short_link_id, (counts.get(click.short_link_id) ?? 0) + 1);
		}
	}

	return flatData.short_links.map((link) => ({
		id: link.id,
		shortUrl: link.short_url,
		originalUrl: link.original_url,
		customAlias: link.custom_alias,
		createdAt: link.created_at,
		totalClicks: counts.get(link.id) ?? 0,
	}));
});
