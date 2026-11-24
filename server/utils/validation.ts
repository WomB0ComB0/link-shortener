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

import { Effect, Schema as S } from "effect";
import { createError } from "h3";

/**
 * Helper to convert Effect Schema validation to H3-compatible format
 */
export function validateRequest<A, I>(
	schema: S.Codec<A, I>,
	input: unknown,
): Effect.Effect<A, S.SchemaError> {
	return S.decodeUnknownEffect(schema)(input);
}

/**
 * Helper to run Effect and handle errors for H3 handlers
 */
export async function runEffect<A>(
	effect: Effect.Effect<A, S.SchemaError>,
): Promise<A> {
	return Effect.runPromise(effect);
}

/**
 * Validate and decode input synchronously, throwing on error
 */
export function validateSync<A, I>(
	schema: S.Codec<A, I>,
	input: unknown,
	customError?: string,
): A {
	try {
		return S.decodeUnknownSync(schema)(input);
	} catch (error) {
		if (customError) {
			throw createError({
				statusCode: 400,
				statusMessage: "Bad Request",
				message: customError,
			});
		}
		throw createError({
			statusCode: 400,
			statusMessage: "Validation Error",
			message: error instanceof Error ? error.message : "Invalid input",
		});
	}
}

/**
 * Validate input and return H3 error if validation fails
 */
export async function validateAsync<A, I>(
	schema: S.Codec<A, I>,
	input: unknown,
): Promise<A> {
	try {
		const effect = S.decodeUnknownEffect(schema)(input);
		return await Effect.runPromise(effect);
	} catch (error) {
		throw createError({
			statusCode: 400,
			statusMessage: "Validation Error",
			message: error instanceof Error ? error.message : "Invalid input",
		});
	}
}

/**
 * Extract validation errors from SchemaError
 */
export function formatValidationErrors(error: S.SchemaError): Array<{
	field: string;
	message: string;
}> {
	return [
		{
			field: "unknown",
			message: error.toString(),
		},
	];
}
