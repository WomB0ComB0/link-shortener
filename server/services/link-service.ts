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

import type { ParseError } from "@effect/schema/ParseResult";
import * as S from "@effect/schema/Schema";
import { Effect, pipe } from "effect";

/**
 * Effect-based service for link shortening operations
 */

// Define error types
export class ValidationError {
	readonly _tag = "ValidationError";
	constructor(
		readonly message: string,
		readonly field?: string,
	) {}
}

export class DatabaseError {
	readonly _tag = "DatabaseError";
	constructor(
		readonly message: string,
		readonly cause?: unknown,
	) {}
}

export class NotFoundError {
	readonly _tag = "NotFoundError";
	constructor(
		readonly message: string,
		readonly id: string,
	) {}
}

export class AuthenticationError {
	readonly _tag = "AuthenticationError";
	constructor(readonly message: string) {}
}

export class RateLimitError {
	readonly _tag = "RateLimitError";
	constructor(
		readonly message: string,
		readonly resetAt: number,
	) {}
}

/**
 * Link Service using Effect
 */
export interface LinkService {
	readonly createLink: (params: {
		originalUrl: string;
		customAlias?: string;
		userId?: string;
		expiresAt?: Date;
	}) => Effect.Effect<
		{ id: string; shortUrl: string; originalUrl: string },
		ValidationError | DatabaseError
	>;

	readonly getLink: (
		shortUrl: string,
	) => Effect.Effect<
		{ id: string; originalUrl: string; isActive: boolean; expiresAt?: Date },
		NotFoundError | DatabaseError
	>;

	readonly recordClick: (params: {
		shortLinkId: string;
		ipAddress?: string;
		userAgent?: string;
		referrer?: string;
	}) => Effect.Effect<void, DatabaseError>;

	readonly getAnalytics: (shortLinkId: string) => Effect.Effect<
		Array<{
			timestamp: Date;
			ipAddress?: string;
			userAgent?: string;
			country?: string;
		}>,
		NotFoundError | DatabaseError
	>;
}

/**
 * Example Effect pipeline for validating and creating a short link
 */
export const createShortLinkEffect = (params: {
	originalUrl: string;
	customAlias?: string;
}) =>
	pipe(
		Effect.succeed(params),
		Effect.flatMap((p) =>
			// Validate URL
			Effect.try({
				try: () => new URL(p.originalUrl),
				catch: () => new ValidationError("Invalid URL format", "originalUrl"),
			}),
		),
		Effect.flatMap(() =>
			// Validate custom alias if provided
			params.customAlias
				? Effect.try({
						try: () => {
							if (!/^[a-zA-Z0-9_-]+$/.test(params.customAlias!)) {
								throw new Error("Invalid alias format");
							}
							return params.customAlias;
						},
						catch: () =>
							new ValidationError(
								"Custom alias must contain only letters, numbers, hyphens, and underscores",
								"customAlias",
							),
					})
				: Effect.succeed(undefined),
		),
		Effect.map(() => ({
			id: crypto.randomUUID(),
			shortUrl: params.customAlias || generateRandomCode(),
			originalUrl: params.originalUrl,
		})),
	);

function generateRandomCode(): string {
	const chars =
		"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	let result = "";
	const bytes = new Uint8Array(6);
	crypto.getRandomValues(bytes);
	for (let i = 0; i < 6; i++) {
		result += chars[bytes[i]! % chars.length];
	}
	return result;
}

/**
 * Example: Composing multiple effects with error handling
 */
export const createAndRecordLink = (params: {
	originalUrl: string;
	customAlias?: string;
	ipAddress?: string;
	userAgent?: string;
}) =>
	pipe(
		createShortLinkEffect(params),
		Effect.flatMap((link) =>
			pipe(
				Effect.succeed({
					shortLinkId: link.id,
					ipAddress: params.ipAddress,
					userAgent: params.userAgent,
					referrer: undefined,
				}),
				Effect.map(() => link),
			),
		),
	);

/**
 * Helper to convert ParseError to custom error type
 */
export const mapParseError = (error: ParseError): ValidationError =>
	new ValidationError(error.toString());

/**
 * Safe decode with Effect error handling
 */
export const safeDecode =
	<A, I>(schema: S.Schema<A, I>) =>
	(input: I) =>
		pipe(S.decode(schema)(input), Effect.mapError(mapParseError));

/**
 * Safe encode with Effect error handling
 */
export const safeEncode =
	<A, I>(schema: S.Schema<A, I>) =>
	(value: A) =>
		pipe(S.encode(schema)(value), Effect.mapError(mapParseError));
