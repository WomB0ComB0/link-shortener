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

export default defineEventHandler(async (event) => {
	const query = getQuery(event);
	const limit = Number(query.limit) || 12;

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

	if (error || !data) {
		return [];
	}

	return data.short_links.map((link) => ({
		id: link.id,
		shortUrl: link.short_url,
		originalUrl: link.original_url,
		customAlias: link.custom_alias,
		createdAt: link.created_at,
		totalClicks: link.clicks_aggregate.aggregate.count,
	}));
});
