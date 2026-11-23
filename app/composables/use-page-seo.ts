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

import { app } from "../constants/app";

export interface PageSeoOptions {
	readonly title: string;
	readonly description: string;
	readonly path?: string;
	/** Use the hero site card (`/opengraph-image`) instead of a dynamic `/api/og` page card. */
	readonly useSiteCard?: boolean;
	readonly robots?: string;
}

/**
 * Build the canonical OpenGraph image URL for a page (dynamic `/api/og` card or
 * hero `/opengraph-image`, matching `mikeodnis.dev` portfolio metadata).
 */
export function buildOgImageUrl(options: {
	readonly title: string;
	readonly description: string;
	readonly useSiteCard?: boolean;
}): string {
	if (options.useSiteCard) {
		return `${app.url}/opengraph-image`;
	}
	const params = new URLSearchParams();
	params.set("title", options.title);
	if (options.description) {
		params.set("description", options.description);
	}
	return `${app.url}/api/og?${params.toString()}`;
}

/**
 * Sets complete OpenGraph, Twitter Card, and canonical metadata for any page.
 */
export function usePageSeo(options: PageSeoOptions): void {
	const fullTitle =
		options.title === app.name || options.title.includes("Links")
			? options.title
			: `${options.title} — ${app.shortName}`;
	const canonicalUrl = options.path
		? `${app.url}${options.path.startsWith("/") ? options.path : `/${options.path}`}`
		: app.url;
	const ogImage = buildOgImageUrl({
		title: options.title,
		description: options.description,
		useSiteCard: options.useSiteCard,
	});
	const twitterImage = options.useSiteCard
		? `${app.url}/twitter-image`
		: ogImage;
	const imageAlt = `${fullTitle}. ${options.description}`;

	useSeoMeta({
		title: fullTitle,
		description: options.description,
		ogTitle: fullTitle,
		ogDescription: options.description,
		ogType: "website",
		ogSiteName: app.name,
		ogUrl: canonicalUrl,
		ogImage,
		ogImageWidth: 1200,
		ogImageHeight: 630,
		ogImageType: "image/png",
		ogImageAlt: imageAlt,
		twitterCard: "summary_large_image",
		twitterTitle: fullTitle,
		twitterDescription: options.description,
		twitterImage,
		twitterImageAlt: imageAlt,
		twitterCreator: "@mike_odnis",
		...(options.robots ? { robots: options.robots } : {}),
	});

	useHead({
		link: [{ rel: "canonical", href: canonicalUrl }],
	});
}
