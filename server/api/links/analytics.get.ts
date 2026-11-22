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

import { createError, defineEventHandler, getQuery } from "h3";
import { GET_LINK_ANALYTICS } from "../../../lib/graphql/operations";
import {
	encodeSync,
	ShortLinkWithAnalytics,
	UUIDSchema,
} from "../../../server/schemas/index";
import { getUserIdFromHeaders } from "../../../server/utils/auth";
import { executeQuery } from "../../../server/utils/graphql";
import { validateSync } from "../../../server/utils/validation";

const GET_LINK_ANALYTICS_FLAT = `
  query GetLinkAnalyticsFlat($shortLinkId: uuid!) {
    short_links(where: {id: {_eq: $shortLinkId}}) {
      id
      user_id
      short_url
      original_url
      custom_alias
      created_at
      is_active
      expires_at
    }
    clicks(
      where: {short_link_id: {_eq: $shortLinkId}}
      order_by: {timestamp: desc}
      limit: 100
    ) {
      id
      timestamp
      user_agent
      referrer
      ip_address
      country
      city
    }
  }
`;

const isMissingRelationshipError = (error: unknown): boolean =>
	error instanceof Error &&
	(error.message.includes("clicks_aggregate") ||
		error.message.includes("field 'clicks' not found"));

export default defineEventHandler(async (event) => {
	const query = getQuery(event);

	// Validate shortLinkId is a valid UUID
	const shortLinkId = validateSync(
		UUIDSchema,
		query.shortLinkId,
		"Short link ID must be a valid UUID",
	);
	const authenticatedUserId =
		event.context?.user?.id ?? getUserIdFromHeaders(event);

	// Query Hasura for the short link and its analytics
	let link: {
		id: string;
		user_id: string | null;
		short_url: string;
		original_url: string;
		custom_alias: string | null;
		created_at: string;
		is_active: boolean;
		expires_at: string | null;
		clicks: Array<{
			id: string;
			timestamp: string;
			user_agent: string | null;
			referrer: string | null;
			ip_address: string | null;
			country: string | null;
			city: string | null;
		}>;
		totalClicks: number;
	} | null = null;

	const { data, error } = await executeQuery<{
		short_links: Array<{
			id: string;
			user_id: string | null;
			short_url: string;
			original_url: string;
			custom_alias: string | null;
			created_at: string;
			is_active: boolean;
			expires_at: string | null;
			clicks: Array<{
				id: string;
				timestamp: string;
				user_agent: string | null;
				referrer: string | null;
				ip_address: string | null;
				country: string | null;
				city: string | null;
			}>;
			clicks_aggregate: {
				aggregate: {
					count: number;
				};
			};
		}>;
	}>(GET_LINK_ANALYTICS, { shortLinkId });

	if (!error && data && data.short_links.length > 0) {
		const found = data.short_links[0];
		if (found) {
			link = {
				...found,
				totalClicks: found.clicks_aggregate.aggregate.count,
			};
		}
	} else if (isMissingRelationshipError(error)) {
		const { data: flatData, error: flatError } = await executeQuery<{
			short_links: Array<{
				id: string;
				user_id: string | null;
				short_url: string;
				original_url: string;
				custom_alias: string | null;
				created_at: string;
				is_active: boolean;
				expires_at: string | null;
			}>;
			clicks: Array<{
				id: string;
				timestamp: string;
				user_agent: string | null;
				referrer: string | null;
				ip_address: string | null;
				country: string | null;
				city: string | null;
			}>;
		}>(GET_LINK_ANALYTICS_FLAT, { shortLinkId });

		if (!flatError && flatData && flatData.short_links.length > 0) {
			const found = flatData.short_links[0];
			if (found) {
				link = {
					...found,
					clicks: flatData.clicks ?? [],
					totalClicks: flatData.clicks?.length ?? 0,
				};
			}
		}
	}

	if (!link) {
		throw createError({
			statusCode: 404,
			statusMessage: "Not Found",
			message: "Short link not found",
		});
	}

	if (authenticatedUserId && link.user_id !== authenticatedUserId) {
		throw createError({
			statusCode: 403,
			statusMessage: "Forbidden",
			message: "You do not have access to this link's analytics",
		});
	}

	// Map clicks to the schema format
	const clicksData = link.clicks.map((click) => ({
		id: click.id,
		shortLinkId,
		timestamp: new Date(click.timestamp),
		userAgent: click.user_agent || undefined,
		referrer: click.referrer || undefined,
		ipAddress: click.ip_address || undefined,
		country: click.country || undefined,
		city: click.city || undefined,
	}));

	// Create response with full link details and analytics
	const response = new ShortLinkWithAnalytics({
		id: link.id,
		originalUrl: link.original_url,
		shortUrl: link.short_url,
		customAlias: link.custom_alias || undefined,
		createdAt: new Date(link.created_at),
		isActive: link.is_active,
		expiresAt: link.expires_at ? new Date(link.expires_at) : undefined,
		clicks: clicksData,
		totalClicks: link.totalClicks,
	});

	return encodeSync(ShortLinkWithAnalytics)(response);
});
