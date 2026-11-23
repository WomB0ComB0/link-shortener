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

import { randomUUID } from "node:crypto";
import { defineEventHandler, getHeader, setResponseHeader } from "h3";

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

/**
 * Propagates a sanitized `X-Request-Id` or generates a fresh UUID per request
 * for end-to-end log and trace correlation.
 */
export default defineEventHandler((event) => {
	const incoming = getHeader(event, "x-request-id")?.trim();
	const requestId =
		incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();

	event.context = {
		...(event.context ?? {}),
		requestId,
	};
	setResponseHeader(event, "X-Request-Id", requestId);
});
