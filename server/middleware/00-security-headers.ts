/**
 * Copyright 2026 Mike Odnis
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

import { defineEventHandler, setResponseHeader } from "h3";

const CONTENT_SECURITY_POLICY = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline' https://cloud.umami.is",
	"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
	"font-src 'self' https://fonts.gstatic.com data:",
	"img-src 'self' data: https:",
	"connect-src 'self' https://cloud.umami.is https://api-gateway.umami.dev",
	"frame-ancestors 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"object-src 'none'",
].join("; ");

const NO_STORE_PREFIXES = [
	"/api/auth/",
	"/api/keys/",
	"/api/links/me",
	"/api/links/analytics",
];

/**
 * Baseline HTTP security headers applied on every response.
 */
export default defineEventHandler((event) => {
	setResponseHeader(event, "X-Content-Type-Options", "nosniff");
	setResponseHeader(event, "X-Frame-Options", "DENY");
	setResponseHeader(event, "Referrer-Policy", "strict-origin-when-cross-origin");
	setResponseHeader(
		event,
		"Permissions-Policy",
		"camera=(), microphone=(), geolocation=(), interest-cohort=()",
	);
	setResponseHeader(event, "Cross-Origin-Opener-Policy", "same-origin");
	setResponseHeader(event, "X-DNS-Prefetch-Control", "off");
	setResponseHeader(event, "Content-Security-Policy", CONTENT_SECURITY_POLICY);

	if (process.env.NODE_ENV === "production") {
		setResponseHeader(
			event,
			"Strict-Transport-Security",
			"max-age=31536000; includeSubDomains",
		);
	}

	const path = (event.path || "").split("?")[0] || "";
	if (NO_STORE_PREFIXES.some((prefix) => path.startsWith(prefix))) {
		setResponseHeader(event, "Cache-Control", "no-store, max-age=0");
		setResponseHeader(event, "Pragma", "no-cache");
	}
});
