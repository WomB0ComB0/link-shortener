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
 * User login endpoint
 * POST /api/auth/login
 * Type-safe with Effect Schema
 */

import * as S from "@effect/schema/Schema";
import { createError, defineEventHandler, readBody } from "h3";
import { GET_USER_BY_EMAIL_WITH_PASSWORD } from "../../../lib/graphql/operations";
import { AuthResponse, LoginRequest } from "../../../server/schemas/index";
import { generateSessionToken, verifyPassword } from "../../utils/auth";
import { executeQuery } from "../../utils/graphql";

export default defineEventHandler(async (event) => {
	const body = await readBody(event);

	// Validate request body using Effect Schema
	let validatedBody: LoginRequest;
	try {
		validatedBody = new LoginRequest(body);
	} catch (error: any) {
		throw createError({
			statusCode: 400,
			statusMessage: "Validation Error",
			message: error.message || "Invalid request body",
		});
	}

	const { email, password } = validatedBody;

	try {
		// Get user by email with password hash
		const { data, error: queryError } = await executeQuery(
			GET_USER_BY_EMAIL_WITH_PASSWORD,
			{ email: email.toLowerCase() },
		);

		if (queryError) {
			console.error("GraphQL query error:", queryError);
			throw createError({
				statusCode: 500,
				statusMessage: "Failed to authenticate user",
			});
		}

		const users = data?.users || [];

		// Check if user exists
		if (users.length === 0) {
			throw createError({
				statusCode: 401,
				statusMessage: "Invalid email or password",
			});
		}

		const user = users[0];

		// Verify password
		const isPasswordValid = await verifyPassword(password, user.password_hash);

		if (!isPasswordValid) {
			throw createError({
				statusCode: 401,
				statusMessage: "Invalid email or password",
			});
		}

		// Generate session token (type-safe)
		const token = generateSessionToken(user.id);

		// Return type-safe response
		const response = new AuthResponse({
			user: {
				id: user.id,
				email: user.email,
				displayName: user.display_name ?? null,
				photoUrl: user.photo_url ?? null,
				createdAt: new Date(user.created_at),
			},
			token,
		});

		return response;
	} catch (error: any) {
		if (error.statusCode) {
			throw error;
		}

		console.error("Login error:", error);
		throw createError({
			statusCode: 500,
			statusMessage: "Failed to login",
		});
	}
});
