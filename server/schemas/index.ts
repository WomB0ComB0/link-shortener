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

import * as S from "@effect/schema/Schema";
import { pipe } from "effect/Function";

/**
 * URL Schema - Validates HTTP/HTTPS URLs
 */
export const UrlSchema = pipe(
	S.String,
	S.filter(
		(url) => {
			try {
				const parsed = new URL(url);
				return parsed.protocol === "http:" || parsed.protocol === "https:";
			} catch {
				return false;
			}
		},
		{
			message: () => "Must be a valid HTTP or HTTPS URL",
		},
	),
);

/**
 * Custom Alias Schema - Alphanumeric, hyphens, underscores only
 */
export const CustomAliasSchema = pipe(
	S.String,
	S.minLength(1),
	S.maxLength(50),
	S.pattern(/^[a-zA-Z0-9_-]+$/),
	S.annotations({
		message: () =>
			"Custom alias must be 1-50 characters and contain only letters, numbers, hyphens, and underscores",
	}),
);

/**
 * Short URL Code Schema - 6 character alphanumeric code
 */
export const ShortUrlCodeSchema = pipe(
	S.String,
	S.minLength(6),
	S.maxLength(6),
	S.pattern(/^[a-zA-Z0-9]+$/),
	S.annotations({
		message: () => "Short URL code must be exactly 6 alphanumeric characters",
	}),
);

/**
 * UUID Schema
 */
export const UUIDSchema = pipe(
	S.String,
	S.pattern(
		/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
	),
	S.annotations({
		message: () => "Must be a valid UUID v4",
	}),
);

/**
 * Master Password Schema - Minimum 8 characters
 */
export const MasterPasswordSchema = pipe(
	S.String,
	S.minLength(8),
	S.annotations({
		message: () => "Master password must be at least 8 characters",
	}),
);

/**
 * Email Schema - Validates email format
 */
export const EmailSchema = pipe(
	S.String,
	S.filter(
		(email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
		{
			message: () => "Must be a valid email address",
		},
	),
	S.annotations({
		description: "A valid email address",
	}),
);

/**
 * Password Schema - Strong password requirements
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
export const PasswordSchema = pipe(
	S.String,
	S.minLength(8),
	S.filter(
		(password) => /[A-Z]/.test(password),
		{
			message: () => "Password must contain at least one uppercase letter",
		},
	),
	S.filter(
		(password) => /[a-z]/.test(password),
		{
			message: () => "Password must contain at least one lowercase letter",
		},
	),
	S.filter(
		(password) => /[0-9]/.test(password),
		{
			message: () => "Password must contain at least one number",
		},
	),
	S.annotations({
		description: "A strong password with at least 8 characters, one uppercase, one lowercase, and one number",
	}),
);

/**
 * Password Hash Schema - SHA-256 hex string
 */
export const PasswordHashSchema = pipe(
	S.String,
	S.pattern(/^[a-f0-9]{64}$/),
	S.annotations({
		message: () => "Must be a valid SHA-256 hash",
		description: "A SHA-256 password hash in hexadecimal format",
	}),
);

/**
 * JWT Token Schema - Base64 encoded token
 */
export const JwtTokenSchema = pipe(
	S.String,
	S.minLength(20),
	S.annotations({
		description: "A JWT-like session token",
	}),
);

/**
 * Display Name Schema - User's display name
 */
export const DisplayNameSchema = pipe(
	S.String,
	S.minLength(1),
	S.maxLength(100),
	S.annotations({
		message: () => "Display name must be 1-100 characters",
		description: "User's display name",
	}),
);

/**
 * IP Address Schema
 */
export const IpAddressSchema = pipe(
	S.String,
	S.pattern(
		/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/,
	),
	S.annotations({
		message: () => "Must be a valid IPv4 or IPv6 address",
	}),
);

/**
 * API Key Schema - Format: sk_[base64url]
 */
export const ApiKeySchema = pipe(
	S.String,
	S.pattern(/^sk_[A-Za-z0-9_-]{43}$/),
	S.annotations({
		message: () => "Must be a valid API key (format: sk_[43 chars])",
	}),
);

/**
 * User Schema
 */
export class User extends S.Class<User>("User")({
	id: UUIDSchema,
	email: EmailSchema,
	displayName: S.NullOr(DisplayNameSchema),
	photoUrl: S.NullOr(S.String),
	createdAt: S.DateFromString,
}) {}

/**
 * ShortLink Schema
 */
export class ShortLink extends S.Class<ShortLink>("ShortLink")({
	id: UUIDSchema,
	userId: S.optional(UUIDSchema),
	originalUrl: UrlSchema,
	shortUrl: S.Union(ShortUrlCodeSchema, CustomAliasSchema),
	customAlias: S.optional(CustomAliasSchema),
	createdAt: S.DateFromString,
	isActive: S.Boolean,
	expiresAt: S.optional(S.DateFromString),
}) {}

/**
 * Click Schema
 */
export class Click extends S.Class<Click>("Click")({
	id: UUIDSchema,
	shortLinkId: UUIDSchema,
	timestamp: S.DateFromString,
	userAgent: S.optional(S.String),
	referrer: S.optional(S.String),
	ipAddress: S.optional(IpAddressSchema),
	country: S.optional(S.String),
	city: S.optional(S.String),
}) {}

/**
 * ApiKey Schema
 */
export class ApiKey extends S.Class<ApiKey>("ApiKey")({
	id: UUIDSchema,
	userId: UUIDSchema,
	key: ApiKeySchema,
	name: S.String,
	createdAt: S.DateFromString,
	isActive: S.Boolean,
	expiresAt: S.optional(S.DateFromString),
	lastUsedAt: S.optional(S.DateFromString),
}) {}

/**
 * Request Schemas
 */

// Create Short Link Request
export class CreateShortLinkRequest extends S.Class<CreateShortLinkRequest>(
	"CreateShortLinkRequest",
)({
	masterPassword: S.optional(MasterPasswordSchema),
	originalUrl: UrlSchema,
	customAlias: S.optional(CustomAliasSchema),
	userId: S.optional(UUIDSchema),
	expiresAt: S.optional(S.DateFromString),
}) {}

// Create Short Link Response
export class CreateShortLinkResponse extends S.Class<CreateShortLinkResponse>(
	"CreateShortLinkResponse",
)({
	id: UUIDSchema,
	originalUrl: UrlSchema,
	shortUrl: S.String,
	customAlias: S.optional(S.String),
	createdAt: S.DateFromString,
}) {}

// Update Short Link Request
export class UpdateShortLinkRequest extends S.Class<UpdateShortLinkRequest>(
	"UpdateShortLinkRequest",
)({
	id: UUIDSchema,
	masterPassword: MasterPasswordSchema,
	isActive: S.optional(S.Boolean),
	expiresAt: S.optional(S.DateFromString),
}) {}

// Delete Short Link Request
export class DeleteShortLinkRequest extends S.Class<DeleteShortLinkRequest>(
	"DeleteShortLinkRequest",
)({
	id: UUIDSchema,
	masterPassword: MasterPasswordSchema,
}) {}

// Get Analytics Request
export class GetAnalyticsRequest extends S.Class<GetAnalyticsRequest>(
	"GetAnalyticsRequest",
)({
	shortLinkId: UUIDSchema,
	masterPassword: MasterPasswordSchema,
}) {}

// Short Link with Analytics Response
export class ShortLinkWithAnalytics extends S.Class<ShortLinkWithAnalytics>(
	"ShortLinkWithAnalytics",
)({
	id: UUIDSchema,
	originalUrl: UrlSchema,
	shortUrl: S.String,
	customAlias: S.optional(S.String),
	createdAt: S.DateFromString,
	isActive: S.Boolean,
	expiresAt: S.optional(S.DateFromString),
	clicks: S.Array(Click),
	totalClicks: S.Number,
}) {}

// API Key Create Request
export class CreateApiKeyRequest extends S.Class<CreateApiKeyRequest>(
	"CreateApiKeyRequest",
)({
	masterPassword: MasterPasswordSchema,
	userId: UUIDSchema,
	name: pipe(S.String, S.minLength(1), S.maxLength(100)),
	expiresAt: S.optional(S.DateFromString),
}) {}

// API Key Response
export class ApiKeyResponse extends S.Class<ApiKeyResponse>("ApiKeyResponse")({
	id: UUIDSchema,
	key: ApiKeySchema,
	name: S.String,
	userId: UUIDSchema,
	createdAt: S.DateFromString,
	expiresAt: S.optional(S.DateFromString),
}) {}

/**
 * Utility Schemas
 */

// Rate Limit Config
export class RateLimitConfig extends S.Class<RateLimitConfig>(
	"RateLimitConfig",
)({
	maxRequests: pipe(S.Number, S.int(), S.positive()),
	windowSeconds: pipe(S.Number, S.int(), S.positive()),
	identifier: S.optional(S.String),
}) {}

// Rate Limit Result
export class RateLimitResult extends S.Class<RateLimitResult>(
	"RateLimitResult",
)({
	allowed: S.Boolean,
	limit: S.Number,
	remaining: S.Number,
	resetAt: S.Number,
}) {}

/**
 * Error Schemas
 */

// Validation Error
export class ValidationError extends S.Class<ValidationError>(
	"ValidationError",
)({
	field: S.String,
	message: S.String,
	value: S.Unknown,
}) {}

// API Error Response
export class ApiErrorResponse extends S.Class<ApiErrorResponse>(
	"ApiErrorResponse",
)({
	statusCode: pipe(S.Number, S.int(), S.between(400, 599)),
	statusMessage: S.String,
	message: S.String,
	errors: S.optional(S.Array(ValidationError)),
}) {}

/**
 * Authentication Schemas
 */

// User with Password Hash (internal use only)
export class UserWithPassword extends S.Class<UserWithPassword>("UserWithPassword")({
	id: UUIDSchema,
	email: EmailSchema,
	displayName: S.NullOr(DisplayNameSchema),
	photoUrl: S.NullOr(S.String),
	passwordHash: PasswordHashSchema,
	createdAt: S.DateFromString,
}) {}

// Register Request
export class RegisterRequest extends S.Class<RegisterRequest>("RegisterRequest")({
	email: EmailSchema,
	password: PasswordSchema,
	displayName: S.optional(DisplayNameSchema),
}) {}

// Login Request
export class LoginRequest extends S.Class<LoginRequest>("LoginRequest")({
	email: EmailSchema,
	password: S.String, // Don't validate on login, just check
}) {}

// Auth Response - Returned from register/login
export class AuthResponse extends S.Class<AuthResponse>("AuthResponse")({
	user: S.Struct({
		id: UUIDSchema,
		email: EmailSchema,
		displayName: S.NullishOr(S.String),
		photoUrl: S.NullishOr(S.String),
		createdAt: S.DateFromString,
	}),
	token: JwtTokenSchema,
}) {}

// Session Token Payload
export class SessionTokenPayload extends S.Class<SessionTokenPayload>("SessionTokenPayload")({
	userId: UUIDSchema,
	iat: pipe(S.Number, S.int(), S.positive()),
	exp: pipe(S.Number, S.int(), S.positive()),
}) {}

// User Profile Response
export class UserProfileResponse extends S.Class<UserProfileResponse>("UserProfileResponse")({
	id: UUIDSchema,
	email: EmailSchema,
	displayName: S.NullishOr(S.String),
	photoUrl: S.NullishOr(S.String),
	createdAt: S.DateFromString,
}) {}

/**
 * GraphQL Response Schemas
 */

// GraphQL User Response (from database)
export class GraphQLUserResponse extends S.Class<GraphQLUserResponse>("GraphQLUserResponse")({
	id: S.String,
	email: S.String,
	display_name: S.NullOr(S.String),
	photo_url: S.NullOr(S.String),
	created_at: S.String,
}) {}

// GraphQL User with Password Response (from database)
export class GraphQLUserWithPasswordResponse extends S.Class<GraphQLUserWithPasswordResponse>("GraphQLUserWithPasswordResponse")({
	id: S.String,
	email: S.String,
	display_name: S.NullOr(S.String),
	photo_url: S.NullOr(S.String),
	password_hash: S.String,
	created_at: S.String,
}) {}

// GraphQL Create User Response
export class GraphQLCreateUserResponse extends S.Class<GraphQLCreateUserResponse>("GraphQLCreateUserResponse")({
	insert_users_one: GraphQLUserResponse,
}) {}

// GraphQL Get User by Email Response
export class GraphQLGetUserByEmailResponse extends S.Class<GraphQLGetUserByEmailResponse>("GraphQLGetUserByEmailResponse")({
	users: S.Array(GraphQLUserResponse),
}) {}

// GraphQL Get User by Email with Password Response
export class GraphQLGetUserByEmailWithPasswordResponse extends S.Class<GraphQLGetUserByEmailWithPasswordResponse>("GraphQLGetUserByEmailWithPasswordResponse")({
	users: S.Array(GraphQLUserWithPasswordResponse),
}) {}

/**
 * Helper functions for decoding/encoding
 */

export const decodeSync =
	<A, I>(schema: S.Schema<A, I>) =>
	(input: I): A => {
		return S.decodeSync(schema)(input);
	};

export const encodeSync =
	<A, I>(schema: S.Schema<A, I>) =>
	(value: A): I => {
		return S.encodeSync(schema)(value);
	};

export const decode =
	<A, I>(schema: S.Schema<A, I>) =>
	(input: I) => {
		return S.decode(schema)(input);
	};

export const encode =
	<A, I>(schema: S.Schema<A, I>) =>
	(value: A) => {
		return S.encode(schema)(value);
	};

/**
 * Validation helpers
 */

export const validateUrl = (url: string): boolean => {
	try {
		S.decodeSync(UrlSchema)(url);
		return true;
	} catch {
		return false;
	}
};

export const validateCustomAlias = (alias: string): boolean => {
	try {
		S.decodeSync(CustomAliasSchema)(alias);
		return true;
	} catch {
		return false;
	}
};

export const validateEmail = (email: string): boolean => {
	try {
		S.decodeSync(EmailSchema)(email);
		return true;
	} catch {
		return false;
	}
};

export const validatePassword = (password: string): boolean => {
	try {
		S.decodeSync(PasswordSchema)(password);
		return true;
	} catch {
		return false;
	}
};

export const validateDisplayName = (name: string): boolean => {
	try {
		S.decodeSync(DisplayNameSchema)(name);
		return true;
	} catch {
		return false;
	}
};

export const validateUUID = (uuid: string): boolean => {
	try {
		S.decodeSync(UUIDSchema)(uuid);
		return true;
	} catch {
		return false;
	}
};
