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

import { FetchHttpClient, type HttpClient } from "@effect/platform";
import { Effect, Layer } from "effect";
import type { FetcherOptions } from "../../lib/fetcher";
import {
	del,
	FetcherError,
	get,
	patch,
	post,
	put,
	ValidationError,
} from "../../lib/fetcher";

/**
 * Composable for using the Effect-based fetcher with proper error handling
 */
export function useFetcher() {
	/**
	 * Get the HttpClient layer based on environment
	 */
	const getHttpClientLayer = () => {
		// Use FetchHttpClient which works in both browser and server environments
		return FetchHttpClient.layer;
	};

	/**
	 * Execute an Effect and convert it to a Promise, handling errors appropriately
	 */
	async function runEffect<T>(
		effect: Effect.Effect<
			T,
			FetcherError | ValidationError,
			HttpClient.HttpClient
		>,
	): Promise<T> {
		return Effect.runPromise(Effect.provide(effect, getHttpClientLayer()));
	}

	/**
	 * GET request helper
	 */
	async function fetchGet<T = unknown>(
		url: string,
		options?: FetcherOptions<T>,
		params?: Record<string, any>,
	): Promise<T> {
		return runEffect(get<T>(url, options, params));
	}

	/**
	 * POST request helper
	 */
	async function fetchPost<T = unknown>(
		url: string,
		body?: any,
		options?: FetcherOptions<T>,
		params?: Record<string, any>,
	): Promise<T> {
		return runEffect(post<T>(url, body, options, params));
	}

	/**
	 * PUT request helper
	 */
	async function fetchPut<T = unknown>(
		url: string,
		body?: any,
		options?: FetcherOptions<T>,
		params?: Record<string, any>,
	): Promise<T> {
		return runEffect(put<T>(url, body, options, params));
	}

	/**
	 * PATCH request helper
	 */
	async function fetchPatch<T = unknown>(
		url: string,
		body?: any,
		options?: FetcherOptions<T>,
		params?: Record<string, any>,
	): Promise<T> {
		return runEffect(patch<T>(url, body, options, params));
	}

	/**
	 * DELETE request helper
	 */
	async function fetchDelete<T = unknown>(
		url: string,
		options?: FetcherOptions<T>,
		params?: Record<string, any>,
	): Promise<T> {
		return runEffect(del<T>(url, options, params));
	}

	return {
		get: fetchGet,
		post: fetchPost,
		put: fetchPut,
		patch: fetchPatch,
		delete: fetchDelete,
		FetcherError,
		ValidationError,
	};
}
