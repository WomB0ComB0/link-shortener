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

// Default short URL characters (base62: alphanumeric)
export const SHORT_URL_CHARSET =
	"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

// Default short URL length
export const SHORT_URL_LENGTH = 6;

// Maximum length for custom alias
export const MAX_CUSTOM_ALIAS_LENGTH = 50;

// Rate limiting configuration
export const RATE_LIMITS = {
	// Creating short links: 10 requests per minute
	CREATE_LINK: {
		maxRequests: 10,
		windowSeconds: 60,
	},
	// Accessing links (redirects): 100 requests per minute
	ACCESS_LINK: {
		maxRequests: 100,
		windowSeconds: 60,
	},
	// API operations: 30 requests per minute
	API: {
		maxRequests: 30,
		windowSeconds: 60,
	},
} as const;

// URL validation regex
export const URL_REGEX =
	/^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/;

// Custom alias validation regex (alphanumeric, hyphens, underscores)
export const ALIAS_REGEX = /^[a-zA-Z0-9_-]+$/;
