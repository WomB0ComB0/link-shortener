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
 * POST /api/keys/create
 *
 * Create a new API key for the authenticated user
 */

import { FetchHttpClient } from "@effect/platform";
import { Effect, Schema } from "effect";
import { post } from "../../../lib/fetcher";
import { generateApiKey, hashApiKey, maskApiKey } from "../../utils/helpers";

// Response schema for API key creation (plaintext key is never returned from DB)
const ApiKeyResponseSchema = Schema.Struct({
	data: Schema.Struct({
		insert_api_keys_one: Schema.Struct({
			id: Schema.String,
			name: Schema.String,
			key_prefix: Schema.NullOr(Schema.String),
			created_at: Schema.String,
			is_active: Schema.Boolean,
			expires_at: Schema.NullOr(Schema.String),
		}),
	}),
});

export default defineEventHandler(async (event) => {
	try {
		// Get authenticated user from context (set by auth middleware)
		const user = event.context.user;

		if (!user) {
			throw createError({
				statusCode: 401,
				message: "Authentication required",
			});
		}

		const body = (await readBody(event)) ?? {};
		const rawName = body?.name;

		if (
			typeof rawName !== "string" ||
			rawName.trim().length === 0 ||
			rawName.trim().length > 100
		) {
			throw createError({
				statusCode: 400,
				message: "API key name must be between 1 and 100 characters",
			});
		}

		const name = rawName.trim();

		// Generate a unique API key; persist only its SHA-256 hash + safe display mask
		const rawApiKey = generateApiKey();
		const keyHash = hashApiKey(rawApiKey);
		const keyPrefix = maskApiKey(rawApiKey);

		// Create hashed API key record in database
		const query = `
      mutation CreateApiKey($key: api_keys_insert_input!) {
        insert_api_keys_one(object: $key) {
          id
          name
          key_prefix
          created_at
          is_active
          expires_at
        }
      }
    `;

		const variables = {
			key: {
				user_id: user.id,
				key: keyHash,
				key_prefix: keyPrefix,
				name,
				is_active: true,
				created_at: new Date().toISOString(),
			},
		};

		const config = useRuntimeConfig();

		// Use Effect-based fetcher
		const effect = post(
			config.hasuraGraphqlEndpoint,
			{
				query,
				variables,
			},
			{
				headers: {
					"Content-Type": "application/json",
					"x-hasura-admin-secret": config.hasuraGraphqlAdminSecret,
				},
				schema: ApiKeyResponseSchema,
				retries: 1,
				timeout: 5000,
			},
		);

		const response = await Effect.runPromise(
			Effect.provide(effect, FetchHttpClient.layer),
		);

		// Return plaintext key once upon creation so the user can store it safely
		return {
			success: true,
			apiKey: {
				...response.data.insert_api_keys_one,
				key: rawApiKey,
				keyPrefix: response.data.insert_api_keys_one.key_prefix ?? keyPrefix,
			},
		};
	} catch (error: any) {
		if (error.statusCode) {
			throw error;
		}

		console.error("Failed to create API key:", error);
		throw createError({
			statusCode: 500,
			message: "Failed to create API key",
		});
	}
});
