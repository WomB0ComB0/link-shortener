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

export const OG_IMAGE_SIZE = { width: 1_200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

export const SITE_CARD_PATH = "/opengraph-image";
export const SITE_TWITTER_CARD_PATH = "/twitter-image";
export const PAGE_CARD_PATH = "/api/og";

export const SITE_TITLE = "Links";
export const SITE_FULL_NAME = "Links — Mike Odnis";
export const SITE_ROLE = "Verified URL shortener";
export const SITE_HOST = "links.mikeodnis.dev";
export const SITE_URL = "https://links.mikeodnis.dev";
export const SITE_TAGLINE =
	"Fast, security-verified short links with click analytics.";

export const siteCardAlt = (): string =>
	`${SITE_FULL_NAME}, ${SITE_ROLE.toLowerCase()}. ${SITE_TAGLINE}`;

export function buildPageOgPath(title: string, description?: string): string {
	const params = new URLSearchParams();
	params.set("title", title);
	if (description) {
		params.set("description", description);
	}
	return `${PAGE_CARD_PATH}?${params.toString()}`;
}
