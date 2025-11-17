/**
 * User registration endpoint
 * POST /api/auth/register
 * Type-safe with Effect Schema
 */

import * as S from "@effect/schema/Schema";
import { createError, defineEventHandler, readBody } from "h3";
import {
	CREATE_USER,
	GET_USER_BY_EMAIL,
} from "../../../lib/graphql/operations";
import {
	AuthResponse,
	DisplayNameSchema,
	EmailSchema,
	PasswordSchema,
	RegisterRequest,
} from "../../../server/schemas/index";
import { generateSessionToken, hashPassword } from "../../../server/utils/auth";
import { executeMutation, executeQuery } from "../../../server/utils/graphql";

export default defineEventHandler(async (event) => {
	const body = await readBody(event);

	// Validate and decode request body using Effect Schema
	let validatedBody: RegisterRequest;
	try {
		validatedBody = new RegisterRequest(body);
	} catch (error: any) {
		throw createError({
			statusCode: 400,
			statusMessage: "Validation Error",
			message: error.message || "Invalid request body",
		});
	}

	const { email, password, displayName } = validatedBody;

	// Check if user already exists
	const { data: existingUser, error: checkError } = await executeQuery<{
		users: any[];
	}>(GET_USER_BY_EMAIL, { email: email.toLowerCase() });

	if (checkError) {
		throw createError({
			statusCode: 500,
			statusMessage: "Database Error",
			message: "Failed to check existing user",
		});
	}

	if (existingUser && existingUser.users.length > 0) {
		throw createError({
			statusCode: 409,
			statusMessage: "Conflict",
			message: "User with this email already exists",
		});
	}

	// Hash password (type-safe)
	const passwordHash = hashPassword(password);

	// Create user
	const { data: result, error: mutationError } = await executeMutation<{
		insert_users_one: any;
	}>(CREATE_USER, {
		email: email.toLowerCase(),
		displayName: displayName || null,
		passwordHash,
	});

	if (mutationError || !result) {
		throw createError({
			statusCode: 500,
			statusMessage: "Database Error",
			message: "Failed to create user",
		});
	}

	const user = result.insert_users_one;

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

	// Encode to ensure type safety on output
	return response;
});
