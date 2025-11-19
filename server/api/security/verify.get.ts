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
 * Link Security Verification Endpoint
 * Allows users to check URL security before creating a short link
 */

import { createError, defineEventHandler, getQuery } from "h3";
import { verifyLink } from "../../../server/security/verification-pipeline";

export default defineEventHandler(async (event) => {
	const query = getQuery(event);
	const url = query.url as string;

	if (!url) {
		throw createError({
			statusCode: 400,
			statusMessage: "Bad Request",
			message: "URL parameter is required",
		});
	}

	// Validate URL format
	try {
		new URL(url);
	} catch {
		throw createError({
			statusCode: 400,
			statusMessage: "Bad Request",
			message: "Invalid URL format",
		});
	}

	try {
		const verification = await verifyLink(url, {
			skipCache: false,
		});

		return {
			success: true,
			verification,
		};
	} catch (error: any) {
		throw createError({
			statusCode: 500,
			statusMessage: "Verification Failed",
			message: error.message || "Failed to verify URL",
		});
	}
});
