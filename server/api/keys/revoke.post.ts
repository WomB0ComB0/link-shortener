/**
 * POST /api/keys/revoke
 *
 * Revoke (deactivate) an API key
 */

import { FetchHttpClient } from "@effect/platform";
import { Effect, Schema } from "effect";
import { post } from "../../../lib/fetcher";

// Response schema for API key revocation
const RevokeApiKeyResponseSchema = Schema.Struct({
	data: Schema.Struct({
		update_api_keys: Schema.Struct({
			affected_rows: Schema.Number,
			returning: Schema.Array(
				Schema.Struct({
					id: Schema.String,
					name: Schema.NullOr(Schema.String),
					is_active: Schema.Boolean,
				}),
			),
		}),
	}),
});

export default defineEventHandler(async (event) => {
	try {
		const user = event.context.user;

		if (!user) {
			throw createError({
				statusCode: 401,
				message: "Authentication required",
			});
		}

		const body = await readBody(event);
		const { keyId } = body;

		if (!keyId || typeof keyId !== "string") {
			throw createError({
				statusCode: 400,
				message: "API key ID is required",
			});
		}

		// Revoke API key (set is_active to false)
		const query = `
      mutation RevokeApiKey($keyId: uuid!, $userId: uuid!) {
        update_api_keys(
          where: { 
            id: { _eq: $keyId }
            user_id: { _eq: $userId }
          }
          _set: { is_active: false }
        ) {
          affected_rows
          returning {
            id
            name
            is_active
          }
        }
      }
    `;

		const variables = {
			keyId,
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
				schema: RevokeApiKeyResponseSchema,
				retries: 1,
				timeout: 5000,
			},
		);

		const response = await Effect.runPromise(
			Effect.provide(effect, FetchHttpClient.layer),
		);

		if (response.data.update_api_keys.affected_rows === 0) {
			throw createError({
				statusCode: 404,
				message: "API key not found or already revoked",
			});
		}

		return {
			success: true,
			message: "API key revoked successfully",
			apiKey: response.data.update_api_keys.returning[0],
		};
	} catch (error: any) {
		if (error.statusCode) {
			throw error;
		}

		throw createError({
			statusCode: 500,
			message: error.message || "Failed to revoke API key",
		});
	}
});
