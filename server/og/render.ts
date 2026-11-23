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

import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { createPageCard, createSiteCard } from "./cards";
import { OG_IMAGE_SIZE } from "./constants";
import { loadOgFonts } from "./fonts";
import type { PageCardText } from "./text";
import type { SatoriNode } from "./wolf-mark";

const MAX_RENDER_CACHE = 64;
const renderCache = new Map<string, Uint8Array>();

export async function renderOgPng(node: SatoriNode): Promise<Uint8Array> {
	const fonts = await loadOgFonts();
	const svg = await satori(node as unknown as Parameters<typeof satori>[0], {
		width: OG_IMAGE_SIZE.width,
		height: OG_IMAGE_SIZE.height,
		fonts: fonts.map((f) => ({
			name: f.name,
			data: f.data,
			weight: f.weight,
			style: f.style,
		})),
	});
	const resvg = new Resvg(svg, {
		fitTo: { mode: "width", value: OG_IMAGE_SIZE.width },
	});
	return new Uint8Array(resvg.render().asPng());
}

export async function renderCardCached(
	page: PageCardText | null,
): Promise<Uint8Array> {
	const key = page ? `${page.title}\0${page.description}` : "__site__";
	const cached = renderCache.get(key);
	if (cached) {
		renderCache.delete(key);
		renderCache.set(key, cached);
		return cached;
	}

	const png = await renderOgPng(
		page ? createPageCard(page) : createSiteCard(),
	);

	if (renderCache.size >= MAX_RENDER_CACHE) {
		const oldest = renderCache.keys().next().value;
		if (oldest !== undefined) {
			renderCache.delete(oldest);
		}
	}
	renderCache.set(key, png);
	return png;
}

export function clearOgRenderCache(): void {
	renderCache.clear();
}
