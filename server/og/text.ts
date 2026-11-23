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

import { SITE_TAGLINE } from "./constants";

export const PAGE_TITLE_MAX = 80;
export const PAGE_DESCRIPTION_MAX = 160;
export const PAGE_DESCRIPTION_UNDER_LONG_TITLE_MAX = 110;

const ELLIPSIS = "…";
const CONTROL = /\p{Cc}+/gu;

const oneLine = (value: string | null | undefined): string =>
	(value ?? "").replace(CONTROL, " ").replace(/\s+/g, " ").trim();

/**
 * Cut `text` to at most `max` characters at a word boundary when possible.
 */
export function clipText(text: string, max: number): string {
	if (text.length <= max) return text;
	const room = text.slice(0, max - ELLIPSIS.length);
	const lastSpace = room.lastIndexOf(" ");
	const cut = lastSpace >= max / 2 ? room.slice(0, lastSpace) : room;
	return `${cut.replace(/[\s,;:.–—-]+$/u, "")}${ELLIPSIS}`;
}

export interface FittedTitle {
	readonly text: string;
	readonly fontSize: number;
}

const TITLE_STEPS: ReadonlyArray<{
	readonly upTo: number;
	readonly fontSize: number;
}> = [
	{ upTo: 16, fontSize: 104 },
	{ upTo: 32, fontSize: 80 },
	{ upTo: PAGE_TITLE_MAX, fontSize: 64 },
];

const SMALLEST_TITLE = 64;

export function fitTitle(title: string): FittedTitle {
	const text = clipText(title, PAGE_TITLE_MAX);
	const step = TITLE_STEPS.find(({ upTo }) => text.length <= upTo);
	return { text, fontSize: step?.fontSize ?? SMALLEST_TITLE };
}

export function fitDescription(
	description: string,
	title: FittedTitle,
): string {
	return title.fontSize > SMALLEST_TITLE
		? description
		: clipText(description, PAGE_DESCRIPTION_UNDER_LONG_TITLE_MAX);
}

export interface PageCardText {
	readonly title: string;
	readonly description: string;
}

export function readPageCard(params: URLSearchParams): PageCardText | null {
	const title = oneLine(params.get("title"));
	if (!title) return null;
	const description = oneLine(params.get("description")) || SITE_TAGLINE;
	return {
		title: clipText(title, PAGE_TITLE_MAX),
		description: clipText(description, PAGE_DESCRIPTION_MAX),
	};
}
