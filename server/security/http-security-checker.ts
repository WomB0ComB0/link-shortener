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

/**
 * HTTP Security Headers, Response Payload & HTML Cloaking Inspector
 * Inspired by lissy93/web-check (`http-security.js`, `headers.js`, `hsts.js`, `mixed-content.js`).
 *
 * Performs a single SSRF-safe, byte-capped (16 KiB) GET inspection of the destination URL:
 *  - Evaluates HTTP security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options,
 *    Referrer-Policy, Permissions-Policy, COOP) and computes a 0-100 posture score & A+-F grade.
 *  - Hard-blocks drive-by malware downloads disguised behind clean URLs via dangerous
 *    `Content-Type` MIME types or `Content-Disposition` executable/double-extension filenames.
 *  - Parses the first 16 KiB of HTML responses to catch `<meta http-equiv="refresh">`
 *    redirect cloaking, cleartext HTTP `<form action>` targets on HTTPS pages, and active
 *    mixed-content (`http://` script/iframe) embeds.
 */

import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import { Schema as S } from "effect";
import { classifyIpAddress } from "./ip-utils";
import { checkSuspiciousPatterns } from "./malware-checker";
import { validateUrl } from "./url-validator";

export type SecurityGrade = "A+" | "A" | "B" | "C" | "D" | "F" | "N/A";

export class HttpSecurityCheckResult extends S.Class<HttpSecurityCheckResult>(
	"HttpSecurityCheckResult",
)({
	isValid: S.Boolean,
	url: S.String,
	statusCode: S.NullOr(S.Number),
	contentType: S.NullOr(S.String),
	contentDispositionFilename: S.NullOr(S.String),
	securityGrade: S.Literals(["A+", "A", "B", "C", "D", "F", "N/A"]),
	headerScore: S.Number,
	headers: S.Struct({
		strictTransportSecurity: S.Boolean,
		hstsMaxAge: S.NullOr(S.Number),
		hstsIncludeSubDomains: S.Boolean,
		hstsPreload: S.Boolean,
		contentSecurityPolicy: S.Boolean,
		xFrameOptions: S.Boolean,
		xContentTypeOptions: S.Boolean,
		referrerPolicy: S.Boolean,
		permissionsPolicy: S.Boolean,
		crossOriginOpenerPolicy: S.Boolean,
	}),
	metaRefreshUrl: S.NullOr(S.String),
	hasMixedContent: S.Boolean,
	hasInsecureFormAction: S.Boolean,
	errors: S.Array(S.String),
	warnings: S.Array(S.String),
	checkTime: S.Number,
}) {}

const DEFAULT_TIMEOUT_MS = 4000;
const MAX_HTML_INSPECT_BYTES = 16 * 1024; // 16 KiB strict memory & bandwidth cap

/**
 * MIME types associated with drive-by executable / installer / script downloads
 */
const DANGEROUS_CONTENT_TYPES = new Set([
	"application/x-msdownload",
	"application/x-dosexec",
	"application/x-msdos-program",
	"application/vnd.microsoft.portable-executable",
	"application/x-executable",
	"application/x-elf",
	"application/x-mach-binary",
	"application/x-sh",
	"application/x-shellscript",
	"application/x-bat",
	"application/x-msi",
	"application/x-ms-shortcut",
	"application/hta",
	"application/vnd.android.package-archive",
	"application/java-archive",
	"application/x-apple-diskimage",
	"application/x-iso9660-image",
	"application/vnd.ms-word.document.macroenabled.12",
	"application/vnd.ms-excel.sheet.macroenabled.12",
	"application/vnd.ms-powerpoint.presentation.macroenabled.12",
]);

const DANGEROUS_FILENAME_EXTENSIONS = [
	".exe",
	".scr",
	".bat",
	".cmd",
	".pif",
	".vbs",
	".vbe",
	".jse",
	".wsf",
	".wsh",
	".ps1",
	".psm1",
	".sh",
	".jar",
	".apk",
	".dmg",
	".msi",
	".msp",
	".dll",
	".iso",
	".img",
	".lnk",
	".hta",
	".chm",
	".docm",
	".xlsm",
	".pptm",
];

const DOUBLE_EXT_FILENAME_REGEX =
	/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|jpg|jpeg|png|gif|zip|rar|txt)\.(exe|scr|bat|cmd|vbs|js|ps1|msi|hta|lnk|jar|apk)$/i;

/**
 * SSRF-safe DNS lookup for outbound HTTP inspection sockets.
 * Refuses to connect to any private, loopback, link-local, or reserved IP.
 */
function safeHttpLookup(
	hostname: string,
	options: dns.LookupOptions,
	callback: (
		err: NodeJS.ErrnoException | null,
		address: string | dns.LookupAddress[],
		family?: number,
	) => void,
): void {
	dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
		if (err) {
			callback(err, "");
			return;
		}
		if (!addresses || addresses.length === 0) {
			callback(new Error("DNS lookup returned no addresses"), "");
			return;
		}

		for (const entry of addresses) {
			const classification = classifyIpAddress(entry.address);
			if (classification.isRestricted) {
				callback(
					new Error(
						`Blocked HTTP inspection to ${classification.reason} IP address: ${entry.address}`,
					),
					"",
				);
				return;
			}
		}

		if (options.all) {
			callback(null, addresses);
		} else {
			const first = addresses[0]!;
			callback(null, first.address, first.family);
		}
	});
}

function getHeaderString(
	headers: http.IncomingHttpHeaders,
	name: string,
): string | null {
	const value = headers[name.toLowerCase()];
	if (Array.isArray(value)) {
		return value.join(", ");
	}
	return typeof value === "string" ? value : null;
}

/**
 * Extract filename from Content-Disposition header (supports `filename=` and RFC 5987 `filename*=`).
 */
export function parseContentDispositionFilename(
	header: string | null,
): string | null {
	if (!header) return null;

	// RFC 5987 extended format: filename*=UTF-8''invoice.exe
	const extMatch = /filename\*\s*=\s*(?:[^']*''|\s*)([^;\r\n]+)/i.exec(header);
	if (extMatch?.[1]) {
		const raw = extMatch[1].trim().replace(/^["']|["']$/g, "");
		try {
			return decodeURIComponent(raw);
		} catch {
			return raw;
		}
	}

	const quotedMatch = /filename\s*=\s*"([^"]+)"/i.exec(header);
	if (quotedMatch?.[1]) {
		return quotedMatch[1].trim();
	}

	const bareMatch = /filename\s*=\s*([^;\r\n]+)/i.exec(header);
	if (bareMatch?.[1]) {
		return bareMatch[1].trim().replace(/^["']|["']$/g, "");
	}

	return null;
}

/**
 * Parse Strict-Transport-Security directives.
 */
export function parseHstsHeader(header: string | null): {
	present: boolean;
	maxAge: number | null;
	includeSubDomains: boolean;
	preload: boolean;
} {
	if (!header) {
		return {
			present: false,
			maxAge: null,
			includeSubDomains: false,
			preload: false,
		};
	}

	const maxAgeMatch = /max-age\s*=\s*(\d+)/i.exec(header);
	const maxAge = maxAgeMatch?.[1] ? Number.parseInt(maxAgeMatch[1], 10) : null;
	const includeSubDomains = /\bincludesubdomains\b/i.test(header);
	const preload = /\bpreload\b/i.test(header);

	return {
		present: true,
		maxAge: Number.isFinite(maxAge) ? maxAge : null,
		includeSubDomains,
		preload,
	};
}

/**
 * Compute HTTP security header score (0-100) and letter grade (A+ to F).
 */
export function scoreSecurityHeaders(
	rawHeaders: http.IncomingHttpHeaders,
	isHttps: boolean,
): {
	headerScore: number;
	securityGrade: SecurityGrade;
	headers: HttpSecurityCheckResult["headers"];
	cookieWarnings: string[];
} {
	const hsts = parseHstsHeader(
		getHeaderString(rawHeaders, "strict-transport-security"),
	);
	const cspRaw = getHeaderString(rawHeaders, "content-security-policy");
	const xfoRaw = getHeaderString(rawHeaders, "x-frame-options");
	const xctoRaw = getHeaderString(rawHeaders, "x-content-type-options");
	const refRaw = getHeaderString(rawHeaders, "referrer-policy");
	const permRaw =
		getHeaderString(rawHeaders, "permissions-policy") ??
		getHeaderString(rawHeaders, "feature-policy");
	const coopRaw = getHeaderString(rawHeaders, "cross-origin-opener-policy");

	const hasCsp = Boolean(cspRaw && cspRaw.trim().length > 0);
	const hasCspFrameAncestors = Boolean(
		cspRaw && /\bframe-ancestors\b/i.test(cspRaw),
	);
	const hasXfo = Boolean(
		xfoRaw && /^(?:deny|sameorigin)/i.test(xfoRaw.trim()),
	);
	const hasXcto = Boolean(xctoRaw && /\bnosniff\b/i.test(xctoRaw));
	const hasRef = Boolean(refRaw && refRaw.trim().length > 0);
	const hasPerm = Boolean(permRaw && permRaw.trim().length > 0);
	const hasCoop = Boolean(coopRaw && coopRaw.trim().length > 0);

	let score = 0;

	// HSTS (25 points max; requires HTTPS)
	if (isHttps && hsts.present && (hsts.maxAge ?? 0) > 0) {
		score += 20;
		if ((hsts.maxAge ?? 0) >= 15_552_000 && hsts.includeSubDomains) {
			score += 5;
		}
	}

	// CSP (25 points)
	if (hasCsp) score += 25;

	// Clickjacking protection via X-Frame-Options or CSP frame-ancestors (15 points)
	if (hasXfo || hasCspFrameAncestors) score += 15;

	// MIME sniffing protection (15 points)
	if (hasXcto) score += 15;

	// Referrer-Policy (10 points)
	if (hasRef) score += 10;

	// Permissions-Policy (5 points)
	if (hasPerm) score += 5;

	// Cross-Origin-Opener-Policy (5 points)
	if (hasCoop) score += 5;

	const headerScore = Math.min(score, 100);
	let securityGrade: SecurityGrade;
	if (headerScore >= 95) securityGrade = "A+";
	else if (headerScore >= 80) securityGrade = "A";
	else if (headerScore >= 65) securityGrade = "B";
	else if (headerScore >= 50) securityGrade = "C";
	else if (headerScore >= 30) securityGrade = "D";
	else securityGrade = "F";

	// Check Set-Cookie hygiene
	const cookieWarnings: string[] = [];
	const setCookies = rawHeaders["set-cookie"];
	if (Array.isArray(setCookies) && setCookies.length > 0 && isHttps) {
		const missingSecure = setCookies.some((c) => !/;\s*secure\b/i.test(c));
		if (missingSecure) {
			cookieWarnings.push("Destination sets cookies without the Secure flag over HTTPS");
		}
	}

	return {
		headerScore,
		securityGrade,
		headers: {
			strictTransportSecurity: hsts.present,
			hstsMaxAge: hsts.maxAge,
			hstsIncludeSubDomains: hsts.includeSubDomains,
			hstsPreload: hsts.preload,
			contentSecurityPolicy: hasCsp,
			xFrameOptions: hasXfo,
			xContentTypeOptions: hasXcto,
			referrerPolicy: hasRef,
			permissionsPolicy: hasPerm,
			crossOriginOpenerPolicy: hasCoop,
		},
		cookieWarnings,
	};
}

/**
 * Inspect bounded HTML snippet (<= 16 KiB) for meta-refresh redirect cloaking,
 * cleartext HTTP form actions, and active mixed-content embeds.
 */
export function inspectHtmlSnippet(
	html: string,
	pageUrl: string,
): {
	metaRefreshRawUrl: string | null;
	metaRefreshResolvedUrl: string | null;
	hasMixedContent: boolean;
	hasInsecureFormAction: boolean;
} {
	const isHttps = pageUrl.startsWith("https://");

	// Extract <meta http-equiv="refresh" content="0; url=..."> regardless of attribute order
	let metaRefreshRawUrl: string | null = null;
	let metaRefreshResolvedUrl: string | null = null;
	const metaTagRegex = /<meta\b[^>]*>/gi;
	let tagMatch: RegExpExecArray | null = metaTagRegex.exec(html);
	while (tagMatch !== null) {
		const tag = tagMatch[0];
		if (/http-equiv\s*=\s*["']?\s*refresh\s*["']?/i.test(tag)) {
			const contentMatch =
				/content\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
			const contentVal =
				contentMatch?.[1] ?? contentMatch?.[2] ?? contentMatch?.[3] ?? "";
			const urlMatch = /\burl\s*=\s*['"]?([^'";\s>]+)['"]?/i.exec(contentVal);
			if (urlMatch?.[1]) {
				metaRefreshRawUrl = urlMatch[1].trim();
				try {
					metaRefreshResolvedUrl = new URL(metaRefreshRawUrl, pageUrl).toString();
				} catch {
					metaRefreshResolvedUrl = null;
				}
				break;
			}
		}
		tagMatch = metaTagRegex.exec(html);
	}

	// Active mixed content on HTTPS pages (<script src="http://..."> or <iframe src="http://...">)
	const hasMixedContent =
		isHttps &&
		/<(?:script|iframe)\b[^>]*\bsrc\s*=\s*["']?\s*http:\/\//i.test(html);

	// Cleartext HTTP form submission from HTTPS page
	const hasInsecureFormAction =
		isHttps &&
		/<form\b[^>]*\baction\s*=\s*["']?\s*http:\/\//i.test(html);

	return {
		metaRefreshRawUrl,
		metaRefreshResolvedUrl,
		hasMixedContent,
		hasInsecureFormAction,
	};
}

function fetchHeadersAndSnippet(
	targetUrl: string,
	timeoutMs: number,
): Promise<{
	statusCode: number;
	headers: http.IncomingHttpHeaders;
	htmlSnippet: string;
}> {
	return new Promise((resolve, reject) => {
		const parsed = new URL(targetUrl);
		const isHttps = parsed.protocol === "https:";
		const client = isHttps ? https : http;
		let settled = false;

		const finish = (result: {
			statusCode: number;
			headers: http.IncomingHttpHeaders;
			htmlSnippet: string;
		}) => {
			if (settled) return;
			settled = true;
			resolve(result);
		};

		const fail = (err: Error) => {
			if (settled) return;
			settled = true;
			reject(err);
		};

		const req = client.request(
			{
				hostname: parsed.hostname,
				port: parsed.port ? Number(parsed.port) : isHttps ? 443 : 80,
				path: `${parsed.pathname}${parsed.search}`,
				method: "GET",
				timeout: timeoutMs,
				rejectUnauthorized: true,
				lookup: safeHttpLookup as http.RequestOptions["lookup"],
				headers: {
					"User-Agent": "LinksSecurityVerifier/2.0 (+https://links.mikeodnis.dev)",
					Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
					"Accept-Encoding": "identity",
				},
			},
			(res) => {
				const statusCode = res.statusCode ?? 0;
				const headers = res.headers;
				const contentType = getHeaderString(headers, "content-type") ?? "";
				const isHtml = /\b(?:text\/html|application\/xhtml\+xml)\b/i.test(
					contentType,
				);

				// Do not read binary/non-HTML bodies at all — close socket immediately
				if (!isHtml) {
					res.destroy();
					req.destroy();
					finish({ statusCode, headers, htmlSnippet: "" });
					return;
				}

				const chunks: Buffer[] = [];
				let totalBytes = 0;

				res.on("data", (chunk: Buffer | string) => {
					const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
					const remaining = MAX_HTML_INSPECT_BYTES - totalBytes;
					if (remaining > 0) {
						chunks.push(buf.subarray(0, remaining));
						totalBytes += Math.min(buf.length, remaining);
					}
					if (totalBytes >= MAX_HTML_INSPECT_BYTES) {
						res.destroy();
						req.destroy();
						finish({
							statusCode,
							headers,
							htmlSnippet: Buffer.concat(chunks).toString("utf8"),
						});
					}
				});

				res.on("end", () => {
					finish({
						statusCode,
						headers,
						htmlSnippet: Buffer.concat(chunks).toString("utf8"),
					});
				});

				res.on("close", () => {
					finish({
						statusCode,
						headers,
						htmlSnippet: Buffer.concat(chunks).toString("utf8"),
					});
				});

				res.on("error", (err) => {
					// If we already captured partial data before destroying, still resolve cleanly
					if (chunks.length > 0) {
						finish({
							statusCode,
							headers,
							htmlSnippet: Buffer.concat(chunks).toString("utf8"),
						});
					} else {
						fail(err);
					}
				});
			},
		);

		req.on("error", (err) => {
			fail(err);
		});

		req.on("timeout", () => {
			req.destroy();
			fail(new Error("HTTP security inspection timed out"));
		});

		req.end();
	});
}

function emptyHeaders(): HttpSecurityCheckResult["headers"] {
	return {
		strictTransportSecurity: false,
		hstsMaxAge: null,
		hstsIncludeSubDomains: false,
		hstsPreload: false,
		contentSecurityPolicy: false,
		xFrameOptions: false,
		xContentTypeOptions: false,
		referrerPolicy: false,
		permissionsPolicy: false,
		crossOriginOpenerPolicy: false,
	};
}

/**
 * Inspect destination HTTP security headers, drive-by payload headers, and HTML cloaking.
 */
export async function checkHttpSecurity(
	url: string,
	timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<HttpSecurityCheckResult> {
	const startTime = Date.now();
	const errors: string[] = [];
	const warnings: string[] = [];

	let isHttps = false;
	try {
		const parsed = new URL(url);
		isHttps = parsed.protocol === "https:";
	} catch {
		return new HttpSecurityCheckResult({
			isValid: false,
			url,
			statusCode: null,
			contentType: null,
			contentDispositionFilename: null,
			securityGrade: "N/A",
			headerScore: 0,
			headers: emptyHeaders(),
			metaRefreshUrl: null,
			hasMixedContent: false,
			hasInsecureFormAction: false,
			errors: ["Invalid URL for HTTP security inspection"],
			warnings: [],
			checkTime: Date.now() - startTime,
		});
	}

	let response: {
		statusCode: number;
		headers: http.IncomingHttpHeaders;
		htmlSnippet: string;
	};
	try {
		response = await fetchHeadersAndSnippet(url, timeoutMs);
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		// SSRF socket block MUST hard-fail; generic upstream timeouts/refusals degrade gracefully
		const isSsrfBlock = /Blocked HTTP inspection to .* IP address/i.test(
			message,
		);
		if (isSsrfBlock) {
			errors.push(message);
		} else {
			warnings.push(`HTTP security inspection skipped (${message})`);
		}

		return new HttpSecurityCheckResult({
			isValid: !isSsrfBlock,
			url,
			statusCode: null,
			contentType: null,
			contentDispositionFilename: null,
			securityGrade: "N/A",
			headerScore: 0,
			headers: emptyHeaders(),
			metaRefreshUrl: null,
			hasMixedContent: false,
			hasInsecureFormAction: false,
			errors,
			warnings,
			checkTime: Date.now() - startTime,
		});
	}

	// 1. Score HTTP security headers & cookie flags
	const headerReport = scoreSecurityHeaders(response.headers, isHttps);
	warnings.push(...headerReport.cookieWarnings);

	// 2. Drive-by download detection via Content-Type & Content-Disposition
	const rawContentType = getHeaderString(response.headers, "content-type");
	const mimeType = rawContentType
		? rawContentType.split(";")[0]!.trim().toLowerCase()
		: null;

	if (mimeType && DANGEROUS_CONTENT_TYPES.has(mimeType)) {
		errors.push(
			`Destination serves dangerous executable/script Content-Type: ${mimeType}`,
		);
	}

	const rawDisposition = getHeaderString(
		response.headers,
		"content-disposition",
	);
	const dispositionFilename = parseContentDispositionFilename(rawDisposition);
	if (dispositionFilename) {
		const lowerName = dispositionFilename.toLowerCase();
		const dangerousExt = DANGEROUS_FILENAME_EXTENSIONS.find((ext) =>
			lowerName.endsWith(ext),
		);
		if (dangerousExt) {
			errors.push(
				`Destination forces download of executable file (${dispositionFilename})`,
			);
		} else if (DOUBLE_EXT_FILENAME_REGEX.test(lowerName)) {
			errors.push(
				`Destination forces download with disguised double extension (${dispositionFilename})`,
			);
		}
	}

	// 3. Bounded HTML snippet inspection (meta-refresh cloaking, mixed content, insecure forms)
	let metaRefreshUrl: string | null = null;
	let hasMixedContent = false;
	let hasInsecureFormAction = false;

	if (response.htmlSnippet) {
		const htmlReport = inspectHtmlSnippet(response.htmlSnippet, url);
		hasMixedContent = htmlReport.hasMixedContent;
		hasInsecureFormAction = htmlReport.hasInsecureFormAction;

		if (hasMixedContent) {
			warnings.push(
				"HTTPS page loads active mixed content (insecure http:// script or iframe)",
			);
		}
		if (hasInsecureFormAction) {
			warnings.push(
				"HTTPS page contains a form submitting credentials/data over insecure HTTP",
			);
		}

		if (htmlReport.metaRefreshRawUrl) {
			if (!htmlReport.metaRefreshResolvedUrl) {
				errors.push(
					`HTML meta-refresh redirect contains malformed target URL: ${htmlReport.metaRefreshRawUrl}`,
				);
			} else {
				metaRefreshUrl = htmlReport.metaRefreshResolvedUrl;
				const metaValidation = await validateUrl(metaRefreshUrl);
				if (!metaValidation.isValid) {
					errors.push(
						`HTML meta-refresh cloaked redirect targets unsafe URL (${metaValidation.errors[0] || "invalid URL"})`,
					);
				} else if (isHttps && metaRefreshUrl.startsWith("http://")) {
					errors.push(
						"HTML meta-refresh redirect downgrades from HTTPS to insecure HTTP",
					);
				} else {
					const patternCheck = checkSuspiciousPatterns(metaRefreshUrl);
					if (
						patternCheck.patterns.some(
							(p) =>
								p.includes("executable extension") ||
								p.includes("double extension") ||
								p.includes("script URI"),
						)
					) {
						errors.push(
							`HTML meta-refresh redirect targets malicious payload (${patternCheck.patterns[0]})`,
						);
					} else if (metaRefreshUrl !== url) {
						warnings.push(
							`Destination page performs HTML meta-refresh redirect to ${metaRefreshUrl}`,
						);
					}
				}
			}
		}
	}

	return new HttpSecurityCheckResult({
		isValid: errors.length === 0,
		url,
		statusCode: response.statusCode,
		contentType: mimeType,
		contentDispositionFilename: dispositionFilename,
		securityGrade: headerReport.securityGrade,
		headerScore: headerReport.headerScore,
		headers: headerReport.headers,
		metaRefreshUrl,
		hasMixedContent,
		hasInsecureFormAction,
		errors,
		warnings,
		checkTime: Date.now() - startTime,
	});
}
