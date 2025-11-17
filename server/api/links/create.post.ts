/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the License, Version 2.0 (the "License");
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

import { defineEventHandler, readBody, createError } from "h3";
import {
	CreateShortLinkRequest,
	CreateShortLinkResponse,
	encodeSync,
} from "../../../server/schemas/index";
import { generateShortCode } from "../../../server/utils/helpers";
import { validateAsync } from "../../../server/utils/validation";
import { executeQuery, executeMutation } from "../../../server/utils/graphql";
import { GET_SHORT_LINK_BY_URL, GET_SHORT_LINK_BY_ALIAS, CREATE_SHORT_LINK } from "../../../lib/graphql/operations";
import { getUserIdFromHeaders } from "../../../server/utils/auth";

export default defineEventHandler(async (event) => {
	// Try to get authenticated user ID from token
	let authenticatedUserId: string | null = null;
	try {
		authenticatedUserId = await getUserIdFromHeaders(event);
	} catch (error) {
		// No valid auth token, continue without user ID
		authenticatedUserId = null;
	}

	// Read and validate request body with Effect Schema
	const rawBody = await readBody(event);
	const validatedBody = await validateAsync(CreateShortLinkRequest, rawBody);

	const { originalUrl, customAlias, userId, expiresAt } = validatedBody;

	// Use authenticated user ID if available, otherwise fall back to request userId
	const effectiveUserId = authenticatedUserId || userId || null;

	// Generate short code if no custom alias provided
	const shortUrl = customAlias || generateShortCode();

	// Check if short URL already exists
	const { data: existingByUrl, error: urlError } = await executeQuery<{ short_links: any[] }>(
		GET_SHORT_LINK_BY_URL,
		{ shortUrl }
	);

	if (urlError) {
		throw createError({
			statusCode: 500,
			statusMessage: "Database Error",
			message: "Failed to check for existing short URL",
		});
	}

	if (existingByUrl && existingByUrl.short_links.length > 0) {
		throw createError({
			statusCode: 409,
			statusMessage: "Conflict",
			message: customAlias 
				? `The custom alias "${customAlias}" is already taken. Please choose a different one.`
				: "Generated code collision. Please try again.",
		});
	}

	// If custom alias provided, also check it doesn't exist
	if (customAlias) {
		const { data: existingByAlias, error: aliasError } = await executeQuery<{ short_links: any[] }>(
			GET_SHORT_LINK_BY_ALIAS,
			{ customAlias }
		);

		if (aliasError) {
			throw createError({
				statusCode: 500,
				statusMessage: "Database Error",
				message: "Failed to check for existing alias",
			});
		}

		if (existingByAlias && existingByAlias.short_links.length > 0) {
			throw createError({
				statusCode: 409,
				statusMessage: "Conflict",
				message: `The custom alias "${customAlias}" is already taken. Please choose a different one.`,
			});
		}
	}

	// Create the short link in Hasura
	const { data: result, error: mutationError } = await executeMutation<{ insert_short_links_one: any }>(
		CREATE_SHORT_LINK,
		{
			originalUrl,
			shortUrl,
			customAlias: customAlias || null,
			userId: effectiveUserId,
		}
	);

	if (mutationError || !result) {
		throw createError({
			statusCode: 500,
			statusMessage: "Database Error",
			message: "Failed to create short link",
		});
	}

	const createdLink = result.insert_short_links_one;

	// Create response using Effect Schema
	const response = new CreateShortLinkResponse({
		id: createdLink.id,
		originalUrl: createdLink.original_url,
		shortUrl: createdLink.short_url,
		customAlias: createdLink.custom_alias || undefined,
		createdAt: new Date(createdLink.created_at),
	});

	// Encode response to ensure it matches schema
	return encodeSync(CreateShortLinkResponse)(response);
});
