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
import { createError, defineEventHandler, getHeader, readBody } from "h3";
import { verifyMasterPassword } from "../utils/helpers.js";
import { getUserIdFromHeaders } from "../utils/auth.js";

/**
 * Middleware to verify authentication for protected routes
 * Accepts either master password OR Bearer token
 */
export default defineEventHandler(async (event: H3Event) => {
	const path = event.path;

	// Protected routes that require authentication
	const protectedRoutes = [
		"/api/links/create",
		"/api/links/update",
		"/api/links/delete",
		"/api/links/analytics",
		"/api/keys/create",
		"/api/keys/revoke",
	];

	// Check if this is a protected route
	const isProtected = protectedRoutes.some((route) => path.startsWith(route));

	if (isProtected) {
		// Check for Bearer token first
		const userId = getUserIdFromHeaders(event);
		if (userId) {
			// Valid Bearer token, allow access
			return;
		}

		// Fall back to master password
		const authHeader = getHeader(event, "x-master-password");
		const body =
			event.method !== "GET" ? await readBody(event).catch(() => ({})) : {};
		const masterPassword = authHeader || body.masterPassword;

		if (!masterPassword) {
			throw createError({
				statusCode: 401,
				statusMessage: "Unauthorized",
				message: "Authentication required: provide either Bearer token or master password",
			});
		}

		if (!verifyMasterPassword(masterPassword)) {
			throw createError({
				statusCode: 403,
				statusMessage: "Forbidden",
				message: "Invalid master password",
			});
		}
	}
});
