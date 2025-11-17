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
