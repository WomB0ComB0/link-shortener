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
import { generateApiKey } from "../../utils/helpers";

// Response schema for API key creation
const ApiKeyResponseSchema = Schema.Struct({
	data: Schema.Struct({
		insert_api_keys_one: Schema.Struct({
			id: Schema.String,
			key: Schema.String,
			name: Schema.String,
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

		const body = await readBody(event);
		const { name } = body;

		if (!name || typeof name !== "string") {
			throw createError({
				statusCode: 400,
				message: "API key name is required",
			});
		}

		// Generate a unique API key
		const apiKey = generateApiKey();

		// Create API key in database
		const query = `
      mutation CreateApiKey($key: api_keys_insert_input!) {
        insert_api_keys_one(object: $key) {
          id
          key
          name
          created_at
          is_active
          expires_at
        }
      }
    `;

		const variables = {
			key: {
				user_id: user.id,
				key: apiKey,
				name: name.trim(),
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

		return {
			success: true,
			apiKey: response.data.insert_api_keys_one,
		};
	} catch (error: any) {
		if (error.statusCode) {
			throw error;
		}

		throw createError({
			statusCode: 500,
			message: error.message || "Failed to create API key",
		});
	}
});
