/**
 * Hasura GraphQL client for server-side operations
 * Type-safe with Effect Schema
 */

import { Client, cacheExchange, fetchExchange } from '@urql/core';
import * as S from '@effect/schema/Schema';
import type { Schema } from '@effect/schema/Schema';

let client: Client | null = null;

export function getGraphQLClient() {
  if (client) {
    return client;
  }

  const config = useRuntimeConfig();
  
  const endpoint = (config.hasuraGraphqlEndpoint || process.env.HASURA_GRAPHQL_ENDPOINT) as string;
  const adminSecret = (config.hasuraGraphqlAdminSecret || process.env.HASURA_GRAPHQL_ADMIN_SECRET) as string;

  if (!endpoint) {
    throw new Error('HASURA_GRAPHQL_ENDPOINT is not configured');
  }

  if (!adminSecret) {
    throw new Error('HASURA_GRAPHQL_ADMIN_SECRET is not configured');
  }

  console.log('[GraphQL] Initializing Hasura client...');
  console.log('[GraphQL] Endpoint:', endpoint);

  client = new Client({
    url: endpoint,
    exchanges: [cacheExchange, fetchExchange],
    fetchOptions: {
      headers: {
        'x-hasura-admin-secret': adminSecret,
      },
    },
    // Disable automatic persisted queries for Hasura
    requestPolicy: 'network-only',
    preferGetMethod: false,
  });

  console.log('[GraphQL] Hasura client initialized successfully');

  return client;
}

/**
 * Execute a GraphQL query
 */
export async function executeQuery<T = any>(
  query: string,
  variables?: Record<string, any>
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const client = getGraphQLClient();
    const result = await client.query(query, variables).toPromise();

    if (result.error) {
      console.error('[GraphQL] Query error:', result.error);
      return { data: null, error: new Error(result.error.message) };
    }

    return { data: result.data as T, error: null };
  } catch (error) {
    console.error('[GraphQL] Query exception:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Execute a GraphQL mutation
 */
export async function executeMutation<T = any>(
  mutation: string,
  variables?: Record<string, any>
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const client = getGraphQLClient();
    const result = await client.mutation(mutation, variables).toPromise();

    if (result.error) {
      console.error('[GraphQL] Mutation error:', result.error);
      return { data: null, error: new Error(result.error.message) };
    }

    return { data: result.data as T, error: null };
  } catch (error) {
    console.error('[GraphQL] Mutation exception:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Type-safe GraphQL query execution with Effect Schema validation
 */
export async function executeTypedQuery<A, I>(
  query: string,
  variables: Record<string, any>,
  schema: Schema<A, I>
): Promise<{ data: A | null; error: Error | null }> {
  try {
    const client = getGraphQLClient();
    const result = await client.query(query, variables).toPromise();

    if (result.error) {
      console.error('[GraphQL] Query error:', result.error);
      return { data: null, error: new Error(result.error.message) };
    }

    // Validate response with Effect Schema
    try {
      const validated = S.decodeSync(schema)(result.data);
      return { data: validated, error: null };
    } catch (validationError: any) {
      console.error('[GraphQL] Response validation error:', validationError);
      return { data: null, error: new Error(`Invalid response format: ${validationError.message}`) };
    }
  } catch (error) {
    console.error('[GraphQL] Query exception:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Type-safe GraphQL mutation execution with Effect Schema validation
 */
export async function executeTypedMutation<A, I>(
  mutation: string,
  variables: Record<string, any>,
  schema: Schema<A, I>
): Promise<{ data: A | null; error: Error | null }> {
  try {
    const client = getGraphQLClient();
    const result = await client.mutation(mutation, variables).toPromise();

    if (result.error) {
      console.error('[GraphQL] Mutation error:', result.error);
      return { data: null, error: new Error(result.error.message) };
    }

    // Validate response with Effect Schema
    try {
      const validated = S.decodeSync(schema)(result.data);
      return { data: validated, error: null };
    } catch (validationError: any) {
      console.error('[GraphQL] Response validation error:', validationError);
      return { data: null, error: new Error(`Invalid response format: ${validationError.message}`) };
    }
  } catch (error) {
    console.error('[GraphQL] Mutation exception:', error);
    return { data: null, error: error as Error };
  }
}
