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
import { getUserIdFromHeaders } from "../../../server/utils/auth";
import { executeQuery } from "../../../server/utils/graphql";

export default defineEventHandler(async (event) => {
	// Get authenticated user ID from token
	const userId = await getUserIdFromHeaders(event);

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

	if (error || !data) {
		throw createError({
			statusCode: 500,
			statusMessage: "Database Error",
			message: "Failed to fetch user links",
		});
	}

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
});
