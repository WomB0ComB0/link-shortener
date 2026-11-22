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

import {
	createError,
	defineEventHandler,
	getHeader,
	getRouterParam,
	sendRedirect,
	setResponseHeader,
} from "h3";
import { getClientIP, getIpLocation } from "../../lib/get-ip";
import {
	CREATE_CLICK,
	GET_SHORT_LINK_BY_CODE,
} from "../../lib/graphql/operations";
import { validateUrl } from "../../server/security/url-validator";
import { executeMutation, executeQuery } from "../../server/utils/graphql";

export default defineEventHandler(async (event) => {
	const shortUrl = getRouterParam(event, "code");

	if (!shortUrl) {
		throw createError({
			statusCode: 400,
			statusMessage: "Bad Request",
			message: "Short URL code is required",
		});
	}

	// Query Hasura to get the link
	const { data, error } = await executeQuery<{ short_links: any[] }>(
		GET_SHORT_LINK_BY_CODE,
		{ code: shortUrl },
	);

	if (error || !data || data.short_links.length === 0) {
		throw createError({
			statusCode: 404,
			statusMessage: "Not Found",
			message: "Short link not found",
		});
	}

	const link = data.short_links[0];

	if (!link.is_active) {
		throw createError({
			statusCode: 410,
			statusMessage: "Gone",
			message: "This short link has been disabled",
		});
	}

	if (link.expires_at && new Date(link.expires_at) < new Date()) {
		throw createError({
			statusCode: 410,
			statusMessage: "Gone",
			message: "This short link has expired",
		});
	}

	// Defense-in-depth: re-validate destination URL before issuing redirect
	const urlCheck = await validateUrl(link.original_url);
	if (!urlCheck.isValid) {
		throw createError({
			statusCode: 403,
			statusMessage: "Forbidden",
			message: "Redirect blocked: destination URL failed security validation",
		});
	}

	// Record click analytics
	const userAgent = getHeader(event, "user-agent");
	const referrer = getHeader(event, "referer") || getHeader(event, "referrer");
	const ipAddress = getClientIP(event);
	const location = await getIpLocation(ipAddress);

	// Record click in Hasura (fire and forget - don't block redirect)
	executeMutation(CREATE_CLICK, {
		shortLinkId: link.id,
		userAgent: userAgent || null,
		referrer: referrer || null,
		ipAddress: ipAddress || null,
		country: location.country || null,
		city: location.city || null,
	}).catch((error) => {
		// Log error but don't fail the redirect
		console.error("Failed to record click:", error);
	});

	// Harden redirect response headers
	setResponseHeader(event, "Referrer-Policy", "no-referrer");
	setResponseHeader(event, "X-Robots-Tag", "noindex, nofollow");

	// Redirect to original URL
	return sendRedirect(event, link.original_url, 302);
});
