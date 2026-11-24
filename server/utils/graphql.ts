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
 * Hasura GraphQL client for server-side operations
 * Type-safe with Effect Schema and explicit per-request fetch timeouts.
 */

import { Schema as S } from "effect";
import { Client, cacheExchange, fetchExchange } from "@urql/core";

const DEFAULT_HASURA_TIMEOUT_MS = 2500;

let client: Client | null = null;

function resolveTimeoutMs(): number {
	const raw = Number(process.env.HASURA_TIMEOUT_MS);
	return Number.isFinite(raw) && raw >= 100 ? raw : DEFAULT_HASURA_TIMEOUT_MS;
}

function createTimedFetch(timeoutMs: number): typeof fetch {
	return (input, init) => {
		const timeoutSignal = AbortSignal.timeout(timeoutMs);
		const signal = init?.signal
			? AbortSignal.any([init.signal, timeoutSignal])
			: timeoutSignal;
		return fetch(input, { ...init, signal });
	};
}

export function resetGraphQLClient(): void {
	client = null;
}

export function getGraphQLClient(): Client {
	if (client) {
		return client;
	}

	const config =
		typeof useRuntimeConfig === "function" ? useRuntimeConfig() : undefined;

	const endpoint = (config?.hasuraGraphqlEndpoint ||
		process.env.HASURA_GRAPHQL_ENDPOINT) as string | undefined;
	const adminSecret = (config?.hasuraGraphqlAdminSecret ||
		process.env.HASURA_GRAPHQL_ADMIN_SECRET) as string | undefined;

	if (!endpoint) {
		throw new Error("HASURA_GRAPHQL_ENDPOINT is not configured");
	}

	if (!adminSecret) {
		throw new Error("HASURA_GRAPHQL_ADMIN_SECRET is not configured");
	}

	client = new Client({
		url: endpoint,
		exchanges: [cacheExchange, fetchExchange],
		fetch: createTimedFetch(resolveTimeoutMs()),
		fetchOptions: {
			headers: {
				"x-hasura-admin-secret": adminSecret,
			},
		},
		requestPolicy: "network-only",
		preferGetMethod: false,
	});

	return client;
}

/**
 * Execute a GraphQL query
 */
export async function executeQuery<T = unknown>(
	query: string,
	variables?: Record<string, unknown>,
): Promise<{ data: T | null; error: Error | null }> {
	try {
		const gqlClient = getGraphQLClient();
		const result = await gqlClient.query(query, variables).toPromise();

		if (result.error) {
			console.error("[GraphQL] Query error:", result.error);
			return { data: null, error: new Error(result.error.message) };
		}

		return { data: result.data as T, error: null };
	} catch (error) {
		console.error("[GraphQL] Query exception:", error);
		return {
			data: null,
			error: error instanceof Error ? error : new Error(String(error)),
		};
	}
}

/**
 * Execute a GraphQL mutation
 */
export async function executeMutation<T = unknown>(
	mutation: string,
	variables?: Record<string, unknown>,
): Promise<{ data: T | null; error: Error | null }> {
	try {
		const gqlClient = getGraphQLClient();
		const result = await gqlClient.mutation(mutation, variables).toPromise();

		if (result.error) {
			console.error("[GraphQL] Mutation error:", result.error);
			return { data: null, error: new Error(result.error.message) };
		}

		return { data: result.data as T, error: null };
	} catch (error) {
		console.error("[GraphQL] Mutation exception:", error);
		return {
			data: null,
			error: error instanceof Error ? error : new Error(String(error)),
		};
	}
}

/**
 * Type-safe GraphQL query execution with Effect Schema validation
 */
export async function executeTypedQuery<A, I>(
	query: string,
	variables: Record<string, unknown>,
	schema: S.Codec<A, I>,
): Promise<{ data: A | null; error: Error | null }> {
	try {
		const gqlClient = getGraphQLClient();
		const result = await gqlClient.query(query, variables).toPromise();

		if (result.error) {
			console.error("[GraphQL] Query error:", result.error);
			return { data: null, error: new Error(result.error.message) };
		}

		try {
			const validated = S.decodeSync(schema)(result.data);
			return { data: validated, error: null };
		} catch (validationError: unknown) {
			console.error("[GraphQL] Response validation error:", validationError);
			const msg =
				validationError instanceof Error
					? validationError.message
					: String(validationError);
			return {
				data: null,
				error: new Error(`Invalid response format: ${msg}`),
			};
		}
	} catch (error) {
		console.error("[GraphQL] Query exception:", error);
		return {
			data: null,
			error: error instanceof Error ? error : new Error(String(error)),
		};
	}
}

/**
 * Type-safe GraphQL mutation execution with Effect Schema validation
 */
export async function executeTypedMutation<A, I>(
	mutation: string,
	variables: Record<string, unknown>,
	schema: S.Codec<A, I>,
): Promise<{ data: A | null; error: Error | null }> {
	try {
		const gqlClient = getGraphQLClient();
		const result = await gqlClient.mutation(mutation, variables).toPromise();

		if (result.error) {
			console.error("[GraphQL] Mutation error:", result.error);
			return { data: null, error: new Error(result.error.message) };
		}

		try {
			const validated = S.decodeSync(schema)(result.data);
			return { data: validated, error: null };
		} catch (validationError: unknown) {
			console.error("[GraphQL] Response validation error:", validationError);
			const msg =
				validationError instanceof Error
					? validationError.message
					: String(validationError);
			return {
				data: null,
				error: new Error(`Invalid response format: ${msg}`),
			};
		}
	} catch (error) {
		console.error("[GraphQL] Mutation exception:", error);
		return {
			data: null,
			error: error instanceof Error ? error : new Error(String(error)),
		};
	}
}
