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
 * Schema.org JSON-LD builders for SEO, AEO (Answer Engine Optimization), and
 * GEO (Generative Engine Optimization), tying `links.mikeodnis.dev` cleanly
 * into the `mikeodnis.dev` entity graph.
 */

import { app } from "../constants/app";

export interface FaqEntry {
	readonly question: string;
	readonly answer: string;
}

export const SITE_FAQS: readonly FaqEntry[] = [
	{
		question: "How does Links verify destination URLs before shortening?",
		answer:
			"Every URL submitted to links.mikeodnis.dev runs through a 9-stage synchronous security & OSINT pipeline checking syntax and SSRF/private-IP restrictions, DNS resolution, TLS/SSL certificates, redirect chains, phishing/homograph heuristics, malware & zero-key threat-intelligence DNSBLs (Cloudflare Security, Quad9), RDAP domain age/suspension & DNSSEC/CAA/DMARC posture, and HTTP security headers with drive-by download and HTML meta-refresh cloaking protection, both at creation time and whenever a destination URL is edited.",
	},
	{
		question: "Why does Links use HTTP 302 redirects instead of 301?",
		answer:
			"Single-hop HTTP 302 Found redirects with short private caching (max-age=90) ensure link takedowns, destination edits, expirations (410 Gone), and click analytics stay accurate and under control rather than being permanently frozen in browser caches.",
	},
	{
		question: "Does Links store visitor IP addresses for click analytics?",
		answer:
			"No. Click analytics are buffered asynchronously in memory and persisted in batches without storing raw IP addresses, while stripping query parameters and fragments from referrer headers.",
	},
	{
		question: "Can I shorten links programmatically via an API?",
		answer:
			"Yes. Signed-in users can mint and revoke SHA-256 hashed sk_ API keys at /keys to create, update, delete, and inspect short links over the JSON API.",
	},
	{
		question: "Is Links installable as a Progressive Web App (PWA)?",
		answer:
			"Yes. Links is an installable standalone PWA with quick shortcuts to Create, Dashboard, and API Keys, plus native Share Target support so URLs shared from mobile or desktop apps open directly in /create.",
	},
];

export function buildSiteGraphJsonLd(): Record<string, unknown> {
	const personId = "https://mikeodnis.dev/#person";
	const portfolioId = "https://mikeodnis.dev/#website";
	const siteId = `${app.url}/#website`;
	const appId = `${app.url}/#webapp`;

	return {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "Person",
				"@id": personId,
				name: "Mike Odnis",
				url: "https://mikeodnis.dev",
				sameAs: [
					"https://github.com/WomB0ComB0",
					"https://x.com/mike_odnis",
					"https://mikeodnis.dev",
				],
			},
			{
				"@type": "WebSite",
				"@id": siteId,
				name: app.name,
				alternateName: app.shortName,
				url: app.url,
				description: app.description,
				inLanguage: "en-US",
				author: { "@id": personId },
				publisher: { "@id": personId },
				isPartOf: { "@id": portfolioId },
			},
			{
				"@type": "WebApplication",
				"@id": appId,
				name: app.name,
				url: app.url,
				description: app.description,
				applicationCategory: "UtilitiesApplication",
				operatingSystem: "Web, iOS, Android, Linux, macOS, Windows",
				browserRequirements: "Requires JavaScript and modern web browser",
				isAccessibleForFree: true,
				license: "https://www.apache.org/licenses/LICENSE-2.0",
				codeRepository: "https://github.com/WomB0ComB0/link-shortener",
				image: `${app.url}/opengraph-image`,
				author: { "@id": personId },
				offers: {
					"@type": "Offer",
					price: "0",
					priceCurrency: "USD",
				},
				featureList: [
					"9-stage synchronous URL security & OSINT verification (SSRF, DNS, SSL, redirects, phishing, malware, DNSBL threat intel, RDAP/DNSSEC/CAA, HTTP headers & cloaking)",
					"Single-hop HTTP 302 redirects backed by L1 LRU and Redis cache-aside",
					"Cryptographically unbiased 7-character Base62 short codes and custom aliases",
					"Privacy-first batched click analytics without raw IP retention",
					"SHA-256 hashed sk_ API keys and owner-authorized link management",
					"Installable Live Console PWA with Web Share Target support",
				],
			},
			{
				"@type": "FAQPage",
				"@id": `${app.url}/#faq`,
				mainEntity: SITE_FAQS.map((item) => ({
					"@type": "Question",
					name: item.question,
					acceptedAnswer: {
						"@type": "Answer",
						text: item.answer,
					},
				})),
			},
		],
	};
}

export function buildBreadcrumbJsonLd(
	path: string,
	pageTitle: string,
): Record<string, unknown> {
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: [
			{
				"@type": "ListItem",
				position: 1,
				name: app.shortName,
				item: `${app.url}/`,
			},
			{
				"@type": "ListItem",
				position: 2,
				name: pageTitle,
				item: `${app.url}${normalizedPath}`,
			},
		],
	};
}
