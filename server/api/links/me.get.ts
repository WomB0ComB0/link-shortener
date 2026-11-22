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

import { createError, defineEventHandler } from "h3";
import { GET_USER_LINKS } from "../../../lib/graphql/operations";
import {
	getUserIdFromHeaders,
	resolveAuthenticatedUserId,
} from "../../../server/utils/auth";
import { executeQuery } from "../../../server/utils/graphql";

const GET_USER_LINKS_FLAT = `
  query GetUserLinksFlat($userId: uuid!) {
    short_links(
      where: {user_id: {_eq: $userId}}
      order_by: {created_at: desc}
    ) {
      id
      short_url
      original_url
      custom_alias
      created_at
      is_active
      expires_at
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

export default defineEventHandler(async (event) => {
	// Get authenticated user ID from session cookie, Bearer token, or active sk_ API key
	const userId =
		event.context?.user?.id ??
		(typeof resolveAuthenticatedUserId === "function"
			? await resolveAuthenticatedUserId(event)
			: await getUserIdFromHeaders(event));

	if (!userId) {
		throw createError({
			statusCode: 401,
			statusMessage: "Unauthorized",
			message: "Authentication required",
		});
	}

	const { data, error } = await executeQuery<{
		short_links: Array<{
			id: string;
			short_url: string;
			original_url: string;
			custom_alias: string | null;
			created_at: string;
			is_active: boolean;
			expires_at: string | null;
			clicks_aggregate: {
				aggregate: {
					count: number;
				};
			};
		}>;
	}>(GET_USER_LINKS, { userId });

	if (!error && data) {
		return data.short_links.map((link) => ({
			id: link.id,
			shortUrl: link.short_url,
			originalUrl: link.original_url,
			customAlias: link.custom_alias,
			createdAt: link.created_at,
			isActive: link.is_active,
			expiresAt: link.expires_at,
			totalClicks: link.clicks_aggregate.aggregate.count,
		}));
	}

	if (!isMissingRelationshipError(error)) {
		throw createError({
			statusCode: 500,
			statusMessage: "Database Error",
			message: "Failed to fetch user links",
		});
	}

	const { data: flatData, error: flatError } = await executeQuery<{
		short_links: Array<{
			id: string;
			short_url: string;
			original_url: string;
			custom_alias: string | null;
			created_at: string;
			is_active: boolean;
			expires_at: string | null;
		}>;
	}>(GET_USER_LINKS_FLAT, { userId });

	if (flatError || !flatData) {
		throw createError({
			statusCode: 500,
			statusMessage: "Database Error",
			message: "Failed to fetch user links",
		});
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
		isActive: link.is_active,
		expiresAt: link.expires_at,
		totalClicks: counts.get(link.id) ?? 0,
	}));
});
