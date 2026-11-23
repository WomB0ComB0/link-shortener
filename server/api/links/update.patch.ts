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
 * Owner-authorized link update endpoint (`PATCH /api/links/update`).
 *
 * Follows DB-first write + immediate cache invalidation:
 * - Re-runs the 6-stage `verifyLink` security pipeline when `originalUrl` changes.
 * - Updates Hasura/Postgres first.
 * - Invalidates both L1 in-process LRU and L2 Redis keys (`short:<code>`).
 */

import { createError, defineEventHandler, readBody } from "h3";
import {
	GET_SHORT_LINK_BY_ID,
	UPDATE_SHORT_LINK,
} from "../../../lib/graphql/operations";
import { invalidateRedirectCache } from "../../../server/cache/redirect-cache";
import { metrics } from "../../../server/observability/metrics";
import { UpdateShortLinkRequest } from "../../../server/schemas/index";
import { verifyLink } from "../../../server/security/verification-pipeline";
import { getUserIdFromHeaders } from "../../../server/utils/auth";
import { executeMutation, executeQuery } from "../../../server/utils/graphql";
import { normalizeDestinationUrl } from "../../../server/utils/helpers";
import { validateAsync } from "../../../server/utils/validation";

interface ShortLinkRow {
	readonly id: string;
	readonly user_id: string | null;
	readonly short_url: string;
	readonly original_url: string;
	readonly custom_alias: string | null;
	readonly is_active: boolean;
	readonly expires_at: string | null;
	readonly created_at: string;
}

export default defineEventHandler(async (event) => {
	const authenticatedUserId: string | null =
		event.context?.user?.id ?? getUserIdFromHeaders(event);

	const rawBody = await readBody(event);
	const body = await validateAsync(UpdateShortLinkRequest, rawBody);

	const { data: existingData, error: lookupError } = await executeQuery<{
		short_links_by_pk: ShortLinkRow | null;
	}>(GET_SHORT_LINK_BY_ID, { id: body.id });

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

	// Owner check (master-password admin has authenticatedUserId === null)
	if (authenticatedUserId && existing.user_id !== authenticatedUserId) {
		throw createError({
			statusCode: 403,
			statusMessage: "Forbidden",
			message: "You do not have permission to update this short link",
		});
	}

	const changes: Record<string, unknown> = {};

	if (body.originalUrl !== undefined) {
		const normalized = normalizeDestinationUrl(body.originalUrl);
		const verification = await verifyLink(normalized, {
			skipCache: false,
			timeout: 10_000,
		});
		if (
			!verification.isVerified ||
			verification.overallRisk === "critical" ||
			verification.overallRisk === "high"
		) {
			const reason =
				verification.summary.criticalIssues.join("; ") ||
				`Risk score ${verification.riskScore}/100 (${verification.overallRisk})`;
			throw createError({
				statusCode: 403,
				statusMessage: "Security Violation",
				message: `Destination URL failed security verification: ${reason}`,
			});
		}
		changes.original_url = normalized;
	}

	if (body.isActive !== undefined) {
		changes.is_active = body.isActive;
	}

	if (body.expiresAt !== undefined) {
		changes.expires_at = body.expiresAt ? body.expiresAt.toISOString() : null;
	}

	if (Object.keys(changes).length === 0) {
		throw createError({
			statusCode: 400,
			statusMessage: "Bad Request",
			message: "Provide at least one field to update (originalUrl, isActive, expiresAt)",
		});
	}

	// Write DB first, then invalidate cache keys
	const { data: updatedData, error: updateError } = await executeMutation<{
		update_short_links_by_pk: ShortLinkRow | null;
	}>(UPDATE_SHORT_LINK, {
		id: body.id,
		changes,
	});

	if (updateError || !updatedData?.update_short_links_by_pk) {
		throw createError({
			statusCode: 500,
			statusMessage: "Database Error",
			message: "Failed to update short link",
		});
	}

	const updated = updatedData.update_short_links_by_pk;
	metrics.linksUpdated += 1;

	await invalidateRedirectCache([
		existing.short_url,
		existing.custom_alias,
		updated.short_url,
		updated.custom_alias,
	]);

	return {
		id: updated.id,
		shortUrl: updated.short_url,
		originalUrl: updated.original_url,
		customAlias: updated.custom_alias ?? undefined,
		isActive: updated.is_active,
		expiresAt: updated.expires_at ?? undefined,
		createdAt: updated.created_at,
	};
});
