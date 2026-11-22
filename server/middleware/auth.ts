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

import type { H3Event } from "h3";
import { createError, defineEventHandler, getHeader } from "h3";
import {
	getUserIdFromHeaders,
	resolveAuthenticatedUserId,
} from "../utils/auth.js";
import { verifyMasterPassword } from "../utils/helpers.js";

/**
 * Authentication middleware for protected API routes.
 *
 * Least-privilege rules:
 * - `/api/keys/*`: requires an interactive user session (HttpOnly cookie or session Bearer);
 *   `sk_` API keys cannot mint/revoke other API keys.
 * - `/api/links/*` protected routes: accept session cookie/Bearer, active hashed `sk_` API key,
 *   or `x-master-password` header.
 */
export default defineEventHandler(async (event: H3Event) => {
	const path = (event.path || "").split("?")[0] || "";

	// Session-only routes (API keys cannot manage other API keys)
	const sessionOnlyRoutes = [
		"/api/keys/list",
		"/api/keys/create",
		"/api/keys/revoke",
	];

	// Protected link routes (session, API key, or master password)
	const protectedLinkRoutes = [
		"/api/links/create",
		"/api/links/update",
		"/api/links/delete",
		"/api/links/analytics",
	];

	const isSessionOnly = sessionOnlyRoutes.some((route) =>
		path.startsWith(route),
	);
	const isProtectedLink = protectedLinkRoutes.some((route) =>
		path.startsWith(route),
	);

	if (!isSessionOnly && !isProtectedLink) {
		return;
	}

	if (isSessionOnly) {
		const sessionUserId = getUserIdFromHeaders(event);
		if (sessionUserId) {
			event.context = {
				...(event.context ?? {}),
				user: { id: sessionUserId },
			};
			return;
		}

		// Preserve explicit master-password rejection behavior if provided, otherwise 401
		const masterPassword = getHeader(event, "x-master-password");
		if (masterPassword) {
			if (!verifyMasterPassword(masterPassword)) {
				throw createError({
					statusCode: 403,
					statusMessage: "Forbidden",
					message: "Invalid master password",
				});
			}
			return;
		}

		throw createError({
			statusCode: 401,
			statusMessage: "Unauthorized",
			message: "Authentication required: sign in to manage API keys",
		});
	}

	// Protected link routes: accept session cookie/Bearer OR active hashed sk_ API key
	const userId = await resolveAuthenticatedUserId(event, { allowApiKey: true });
	if (userId) {
		event.context = {
			...(event.context ?? {}),
			user: { id: userId },
		};
		return;
	}

	// Fall back to master password header
	const masterPassword = getHeader(event, "x-master-password");
	if (!masterPassword) {
		throw createError({
			statusCode: 401,
			statusMessage: "Unauthorized",
			message:
				"Authentication required: provide a session cookie, Bearer token/API key, or x-master-password header",
		});
	}

	if (!verifyMasterPassword(masterPassword)) {
		throw createError({
			statusCode: 403,
			statusMessage: "Forbidden",
			message: "Invalid master password",
		});
	}
});
