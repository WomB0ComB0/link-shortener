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

import { defineEventHandler, getQuery, createError } from "h3";
import {
	encodeSync,
	ShortLinkWithAnalytics,
	UUIDSchema,
} from "../../../server/schemas/index";
import { validateSync } from "../../../server/utils/validation";
import { executeQuery } from "../../../server/utils/graphql";
import { GET_LINK_ANALYTICS } from "../../../lib/graphql/operations";

export default defineEventHandler(async (event) => {
	const query = getQuery(event);

	// Validate shortLinkId is a valid UUID
	const shortLinkId = validateSync(
		UUIDSchema,
		query.shortLinkId,
		"Short link ID must be a valid UUID",
	);

	// Query Hasura for the short link and its analytics
	const { data, error } = await executeQuery<{ 
		short_links: Array<{
			id: string;
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
		}>
	}>(GET_LINK_ANALYTICS, { shortLinkId });

	if (error || !data || data.short_links.length === 0) {
		throw createError({
			statusCode: 404,
			statusMessage: "Not Found",
			message: "Short link not found",
		});
	}

	const link = data.short_links[0];

	// Map clicks to the schema format
	const clicksData = link.clicks.map(click => ({
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
		totalClicks: link.clicks_aggregate.aggregate.count,
	});

	return encodeSync(ShortLinkWithAnalytics)(response);
});
