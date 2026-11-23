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

import { createError, defineEventHandler, setResponseHeader } from "h3";
import { OG_CONTENT_TYPE } from "../og/constants";
import { renderCardCached } from "../og/render";

const OG_CACHE_CONTROL =
	"public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

export default defineEventHandler(async (event) => {
	try {
		const png = await renderCardCached(null);
		setResponseHeader(event, "Content-Type", OG_CONTENT_TYPE);
		setResponseHeader(event, "Cache-Control", OG_CACHE_CONTROL);
		return png;
	} catch (error) {
		console.error(
			"[OG] Failed to generate Twitter image:",
			error instanceof Error ? error.message : String(error),
		);
		throw createError({
			statusCode: 500,
			statusMessage: "Internal Server Error",
			message: "Failed to generate Twitter image",
		});
	}
});
