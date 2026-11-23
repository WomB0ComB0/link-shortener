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

/**
 * Owner-authorized link deletion endpoint (`DELETE /api/links/delete`).
 *
 * Deletes from DB first, then immediately invalidates both L1 in-process LRU
 * and L2 Redis keys (`short:<code>`).
 */

import { createError, defineEventHandler, getQuery, readBody } from "h3";
import {
	DELETE_SHORT_LINK,
	GET_SHORT_LINK_BY_ID,
} from "../../../lib/graphql/operations";
import { invalidateRedirectCache } from "../../../server/cache/redirect-cache";
import { metrics } from "../../../server/observability/metrics";
import { UUIDSchema } from "../../../server/schemas/index";
import { getUserIdFromHeaders } from "../../../server/utils/auth";
import { executeMutation, executeQuery } from "../../../server/utils/graphql";
import { validateSync } from "../../../server/utils/validation";

interface ShortLinkRow {
	readonly id: string;
	readonly user_id: string | null;
	readonly short_url: string;
	readonly custom_alias: string | null;
}

export default defineEventHandler(async (event) => {
	const authenticatedUserId: string | null =
		event.context?.user?.id ?? getUserIdFromHeaders(event);

	const query = getQuery(event);
	let rawId: unknown = query.id;
	if (!rawId) {
		try {
			const body = (await readBody(event)) as Record<string, unknown> | null;
			rawId = body?.id;
		} catch {
			rawId = undefined;
		}
	}

	const id = validateSync(UUIDSchema, rawId, "Short link ID must be a valid UUID");

	const { data: existingData, error: lookupError } = await executeQuery<{
		short_links_by_pk: ShortLinkRow | null;
	}>(GET_SHORT_LINK_BY_ID, { id });

	if (lookupError) {
		throw createError({
			statusCode: 500,
			statusMessage: "Database Error",
			message: "Failed to load short link",
		});
	}

	const existing = existingData?.short_links_by_pk;
	if (!existing) {
		throw createError({
			statusCode: 404,
			statusMessage: "Not Found",
			message: "Short link not found",
		});
	}

	if (authenticatedUserId && existing.user_id !== authenticatedUserId) {
		throw createError({
			statusCode: 403,
			statusMessage: "Forbidden",
			message: "You do not have permission to delete this short link",
		});
	}

	// Delete in DB first, then immediately evict cached redirect entries
	const { data: deletedData, error: deleteError } = await executeMutation<{
		delete_short_links_by_pk: {
			id: string;
			short_url: string;
			custom_alias: string | null;
		} | null;
	}>(DELETE_SHORT_LINK, { id });

	if (deleteError || !deletedData?.delete_short_links_by_pk) {
		throw createError({
			statusCode: 500,
			statusMessage: "Database Error",
			message: "Failed to delete short link",
		});
	}

	metrics.linksDeleted += 1;

	await invalidateRedirectCache([existing.short_url, existing.custom_alias]);

	return {
		deleted: true,
		id: existing.id,
		shortUrl: existing.short_url,
	};
});
