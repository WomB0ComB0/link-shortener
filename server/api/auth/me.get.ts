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

/**
 * User profile endpoint
 * GET /api/auth/me
 * Type-safe with Effect Schema
 */

import { createError, defineEventHandler } from "h3";
import { GET_USER_BY_ID } from "../../../lib/graphql/operations";
import { UserProfileResponse } from "../../../server/schemas/index";
import { getUserIdFromHeaders } from "../../utils/auth";
import { executeQuery } from "../../utils/graphql";

export default defineEventHandler(async (event) => {
	try {
		// Get user ID from auth token (type-safe)
		const userId = getUserIdFromHeaders(event);

		if (!userId) {
			throw createError({
				statusCode: 401,
				statusMessage: "Unauthorized - valid token required",
			});
		}

		// Get user details
		const { data, error: queryError } = await executeQuery(GET_USER_BY_ID, {
			userId: userId,
		});

		if (queryError) {
			console.error("GraphQL query error:", queryError);
			throw createError({
				statusCode: 500,
				statusMessage: "Failed to fetch user profile",
			});
		}

		const users = data?.users || [];

		if (users.length === 0) {
			throw createError({
				statusCode: 404,
				statusMessage: "User not found",
			});
		}

		const user = users[0];

		// Return type-safe response
		const response = new UserProfileResponse({
			id: user.id,
			email: user.email,
			displayName: user.display_name ?? null,
			photoUrl: user.photo_url ?? null,
			createdAt: new Date(user.created_at),
		});

		return response;
	} catch (error: any) {
		if (error.statusCode) {
			throw error;
		}

		console.error("Profile fetch error:", error);
		throw createError({
			statusCode: 500,
			statusMessage: "Failed to fetch profile",
		});
	}
});
