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
 * GET /api/keys/list
 *
 * List all API keys for the authenticated user
 */

import { FetchHttpClient } from "@effect/platform";
import { Effect, Schema } from "effect";
import { post } from "../../../lib/fetcher";

// Response schema for API keys list
const ApiKeysListResponseSchema = Schema.Struct({
	data: Schema.Struct({
		api_keys: Schema.Array(
			Schema.Struct({
				id: Schema.String,
				name: Schema.NullOr(Schema.String),
				key: Schema.String,
				created_at: Schema.String,
				is_active: Schema.Boolean,
				expires_at: Schema.NullOr(Schema.String),
				last_used_at: Schema.NullOr(Schema.String),
			}),
		),
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

		// Fetch user's API keys from database
		const query = `
      query GetApiKeys($userId: uuid!) {
        api_keys(
          where: { user_id: { _eq: $userId } }
          order_by: { created_at: desc }
        ) {
          id
          name
          key
          created_at
          is_active
          expires_at
          last_used_at
        }
      }
    `;

		const variables = {
			userId: user.id,
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
				schema: ApiKeysListResponseSchema,
				retries: 1,
				timeout: 5000,
			},
		);

		const response = await Effect.runPromise(
			Effect.provide(effect, FetchHttpClient.layer),
		);

		// Mask API keys (show only last 8 characters)
		const apiKeys = response.data.api_keys.map((key) => ({
			...key,
			key: `...${key.key.slice(-8)}`,
		}));

		return {
			success: true,
			apiKeys,
		};
	} catch (error: any) {
		if (error.statusCode) {
			throw error;
		}

		throw createError({
			statusCode: 500,
			message: error.message || "Failed to fetch API keys",
		});
	}
});
