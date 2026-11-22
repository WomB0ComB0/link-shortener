/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the License, Version 2.0 (the "License");
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

import { timingSafeEqual } from "node:crypto";
import { createError, defineEventHandler, getHeader, readBody } from "h3";
import {
	CREATE_SHORT_LINK,
	GET_SHORT_LINK_BY_ALIAS,
	GET_SHORT_LINK_BY_URL,
} from "../../../lib/graphql/operations";
import {
	CreateShortLinkRequest,
	CreateShortLinkResponse,
	encodeSync,
} from "../../../server/schemas/index";
import {
	type LinkVerificationResult,
	verifyLink,
} from "../../../server/security/verification-pipeline";
import { getUserIdFromHeaders } from "../../../server/utils/auth";
import { executeMutation, executeQuery } from "../../../server/utils/graphql";
import { generateShortCode } from "../../../server/utils/helpers";
import { validateAsync } from "../../../server/utils/validation";

function isValidAdminBypass(event: Parameters<typeof getHeader>[0]): boolean {
	const configuredSecret = process.env.ADMIN_BYPASS_SECRET?.trim();
	// Require a non-empty, strong secret (>= 16 chars) and explicit opt-in header
	if (!configuredSecret || configuredSecret.length < 16) {
		return false;
	}

	const skipRequested = getHeader(event, "x-skip-verification") === "true";
	const providedSecret = getHeader(event, "x-admin-bypass")?.trim();
	if (!skipRequested || !providedSecret) {
		return false;
	}

	const expectedBuf = Buffer.from(configuredSecret, "utf8");
	const actualBuf = Buffer.from(providedSecret, "utf8");
	if (expectedBuf.length !== actualBuf.length) {
		return false;
	}

	return timingSafeEqual(expectedBuf, actualBuf);
}

function summarizeVerification(verification: LinkVerificationResult) {
	return {
		isVerified: verification.isVerified,
		overallRisk: verification.overallRisk,
		riskScore: verification.riskScore,
		criticalIssues: verification.summary.criticalIssues,
		recommendations: verification.summary.recommendations,
		finalUrl: verification.checks.redirectCheck?.finalUrl ?? verification.url,
		redirectHops: verification.checks.redirectCheck?.hopCount ?? 0,
		checks: {
			url: {
				passed: Boolean(verification.checks.urlValidation?.isValid),
				warnings: verification.checks.urlValidation?.warnings?.length ?? 0,
			},
			dns: {
				passed: Boolean(verification.checks.dnsCheck?.isValid),
				warnings: verification.checks.dnsCheck?.warnings?.length ?? 0,
			},
			ssl: {
				passed: Boolean(verification.checks.sslCheck?.isValid),
				warnings: verification.checks.sslCheck?.warnings?.length ?? 0,
			},
			redirects: {
				passed: Boolean(verification.checks.redirectCheck?.isValid),
				warnings: verification.checks.redirectCheck?.warnings?.length ?? 0,
			},
			phishing: {
				passed: !verification.checks.phishingCheck?.isPhishing,
				warnings: verification.checks.phishingCheck?.warnings?.length ?? 0,
			},
			malware: {
				passed:
					(verification.checks.malwareCheck?.threats?.length ?? 0) === 0 &&
					(process.env.SECURITY_REQUIRE_SAFE_BROWSING !== "true" ||
						(verification.checks.malwareCheck?.errors?.length ?? 0) === 0),
				warnings:
					(verification.checks.malwareCheck?.warnings?.length ?? 0) +
					(verification.checks.malwareCheck?.errors?.length ?? 0),
			},
		},
	};
}

const RESERVED_ALIASES = new Set([
	"api",
	"auth",
	"create",
	"dashboard",
	"keys",
	"offline",
	"admin",
	"login",
	"logout",
	"register",
	"health",
	"status",
	"assets",
	"_nuxt",
	"pwa",
	"robots",
	"sitemap",
	"favicon",
]);

export default defineEventHandler(async (event) => {
	// Resolve authenticated user ID (set by auth middleware for session cookie, Bearer, or sk_ API key)
	let authenticatedUserId: string | null = event.context?.user?.id ?? null;
	if (!authenticatedUserId) {
		try {
			authenticatedUserId = await getUserIdFromHeaders(event);
		} catch {
			authenticatedUserId = null;
		}
	}

	// Read and validate request body with Effect Schema
	const rawBody = await readBody(event);
	const validatedBody = await validateAsync(CreateShortLinkRequest, rawBody);

	const { originalUrl, customAlias, expiresAt } = validatedBody;

	// Prevent route shadowing with reserved application paths
	if (customAlias && RESERVED_ALIASES.has(customAlias.toLowerCase())) {
		throw createError({
			statusCode: 400,
			statusMessage: "Bad Request",
			message: `The custom alias "${customAlias}" is reserved. Please choose a different one.`,
		});
	}

	// Never trust client-supplied userId from request body (prevents IDOR attribution spoofing)
	const effectiveUserId = authenticatedUserId;

	// ============================================
	// STRICT 6-STAGE SECURITY VERIFICATION PIPELINE
	// ============================================
	const adminBypass = isValidAdminBypass(event);

	if (!adminBypass) {
		try {
			const verification: LinkVerificationResult = await verifyLink(
				originalUrl,
				{
					skipCache: false,
					timeout: 10000,
				},
			);

			// Store verification result in request context for later use
			event.context.verification = verification;
			const verificationSummary = summarizeVerification(verification);

			// Strict enforcement: block any critical/high risk or unverified URL
			if (
				!verification.isVerified ||
				verification.overallRisk === "critical" ||
				verification.overallRisk === "high"
			) {
				const reasonList =
					verification.summary.criticalIssues.length > 0
						? verification.summary.criticalIssues.join("; ")
						: `Risk score ${verification.riskScore}/100 (${verification.overallRisk})`;

				throw createError({
					statusCode: 403,
					statusMessage: "Security Violation",
					message: `URL failed security verification: ${reasonList}`,
					data: {
						verification: verificationSummary,
					},
				});
			}

			// Log medium risk URLs that still passed all hard checks
			if (verification.overallRisk === "medium") {
				console.info(`Medium-risk URL: ${originalUrl}`, {
					riskScore: verification.riskScore,
					warnings: verification.summary.recommendations,
				});
			}
		} catch (verificationError: any) {
			if (verificationError?.statusCode) {
				throw verificationError; // Re-throw structured HTTP errors
			}

			// Fail closed on unexpected security pipeline failures
			console.error("Verification pipeline error:", verificationError);
			throw createError({
				statusCode: 503,
				statusMessage: "Security Verification Unavailable",
				message:
					"Unable to complete security verification for this URL. Please try again.",
			});
		}
	}

	// ============================================
	// LINK CREATION (existing logic)
	// ============================================

	// Generate short code if no custom alias provided
	const shortUrl = customAlias || generateShortCode();

	// Check if short URL already exists
	const { data: existingByUrl, error: urlError } = await executeQuery<{
		short_links: any[];
	}>(GET_SHORT_LINK_BY_URL, { shortUrl });

	if (urlError) {
		throw createError({
			statusCode: 500,
			statusMessage: "Database Error",
			message: "Failed to check for existing short URL",
		});
	}

	if (existingByUrl && existingByUrl.short_links.length > 0) {
		throw createError({
			statusCode: 409,
			statusMessage: "Conflict",
			message: customAlias
				? `The custom alias "${customAlias}" is already taken. Please choose a different one.`
				: "Generated code collision. Please try again.",
		});
	}

	// If custom alias provided, also check it doesn't exist
	if (customAlias) {
		const { data: existingByAlias, error: aliasError } = await executeQuery<{
			short_links: any[];
		}>(GET_SHORT_LINK_BY_ALIAS, { customAlias });

		if (aliasError) {
			throw createError({
				statusCode: 500,
				statusMessage: "Database Error",
				message: "Failed to check for existing alias",
			});
		}

		if (existingByAlias && existingByAlias.short_links.length > 0) {
			throw createError({
				statusCode: 409,
				statusMessage: "Conflict",
				message: `The custom alias "${customAlias}" is already taken. Please choose a different one.`,
			});
		}
	}

	// Create the short link in Hasura
	const { data: result, error: mutationError } = await executeMutation<{
		insert_short_links_one: any;
	}>(CREATE_SHORT_LINK, {
		originalUrl,
		shortUrl,
		customAlias: customAlias || null,
		userId: effectiveUserId,
		expiresAt: expiresAt ? expiresAt.toISOString() : null,
	});

	if (mutationError || !result) {
		throw createError({
			statusCode: 500,
			statusMessage: "Database Error",
			message: "Failed to create short link",
		});
	}

	const createdLink = result.insert_short_links_one;

	// Create response using Effect Schema
	const response = new CreateShortLinkResponse({
		id: createdLink.id,
		originalUrl: createdLink.original_url,
		shortUrl: createdLink.short_url,
		customAlias: createdLink.custom_alias || undefined,
		createdAt: new Date(createdLink.created_at),
	});

	// Encode response to ensure it matches schema
	const encodedResponse = encodeSync(CreateShortLinkResponse)(response);

	// Add verification result to response if available
	if (event.context.verification) {
		return {
			...encodedResponse,
			verification: summarizeVerification(event.context.verification),
		};
	}

	return encodedResponse;
});
