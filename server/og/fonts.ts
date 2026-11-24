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

import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface OgFont {
	readonly name: "Geist" | "Geist Mono";
	readonly data: ArrayBuffer;
	readonly weight: 400 | 500 | 600;
	readonly style: "normal";
}

const FONT_FILES = [
	{ file: "Geist-Regular.ttf", name: "Geist", weight: 400 },
	{ file: "Geist-Medium.ttf", name: "Geist", weight: 500 },
	{ file: "Geist-SemiBold.ttf", name: "Geist", weight: 600 },
	{ file: "GeistMono-Regular.ttf", name: "Geist Mono", weight: 400 },
] as const;

const bytesOf = (buffer: Uint8Array): ArrayBuffer =>
	buffer.buffer.slice(
		buffer.byteOffset,
		buffer.byteOffset + buffer.byteLength,
	) as ArrayBuffer;

async function readFromNitroStorage(filename: string): Promise<Uint8Array | null> {
	try {
		const storageFn = (
			globalThis as {
				useStorage?: (
					base?: string,
				) => { getItemRaw: (key: string) => Promise<unknown> };
			}
		).useStorage;
		if (typeof storageFn !== "function") return null;
		const raw = await storageFn("assets:og-fonts").getItemRaw(filename);
		if (raw instanceof Uint8Array) return raw;
		if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
		return null;
	} catch {
		return null;
	}
}

async function readFontFile(filename: string): Promise<Uint8Array> {
	const bundled = await readFromNitroStorage(filename);
	if (bundled) return bundled;

	const candidates = [
		join(process.cwd(), "server/og/fonts", filename),
		join(process.cwd(), "public/assets/fonts/og", filename),
		join(process.cwd(), ".output/public/assets/fonts/og", filename),
	];

	let lastError: unknown;
	for (const candidate of candidates) {
		try {
			return await readFile(candidate);
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError ?? new Error(`Could not locate OG font: ${filename}`);
}

let loading: Promise<readonly OgFont[]> | undefined;

async function readFaces(): Promise<readonly OgFont[]> {
	const buffers = await Promise.all(
		FONT_FILES.map((entry) => readFontFile(entry.file)),
	);
	return FONT_FILES.map((entry, idx) => ({
		name: entry.name,
		data: bytesOf(buffers[idx]!),
		weight: entry.weight,
		style: "normal" as const,
	}));
}

export function loadOgFonts(): Promise<readonly OgFont[]> {
	loading ??= readFaces().catch((error: unknown) => {
		loading = undefined;
		throw error;
	});
	return loading;
}
