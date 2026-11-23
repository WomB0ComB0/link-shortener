/**
 * Copyright 2025 Mike Odnis
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
 * Live Console PWA configuration for `links.mikeodnis.dev`, aligned with
 * `mikeodnis.dev` (`portfolio/src/app/manifest.ts`):
 * - Tinted-black `#0c0c14` canvas & theme color
 * - Wolf-mark SVG + 192/512 standard & maskable PNG icons
 * - Actionable shortcuts (`/create`, `/dashboard`, `/keys`)
 * - Native `share_target` routing shared URLs to `/create?url=...`
 * - Workbox caching that never intercepts `/api/*` or short-link redirects
 */

import type { ModuleOptions } from "@vite-pwa/nuxt";
import { app } from "../constants/index.js";

const SCOPE = "/";
export const THEME_COLOR = "#0c0c14";

export const PWA_MANIFEST = {
	id: SCOPE,
	scope: SCOPE,
	name: app.name,
	short_name: app.shortName,
	description: app.description,
	lang: "en-US",
	dir: "ltr" as const,
	start_url: SCOPE,
	display: "standalone" as const,
	display_override: ["standalone", "minimal-ui"],
	orientation: "any" as const,
	theme_color: THEME_COLOR,
	background_color: THEME_COLOR,
	categories: ["utilities", "productivity"],
	prefer_related_applications: false,
	related_applications: [],
	edge_side_panel: {
		preferred_width: 480,
	},
	launch_handler: {
		client_mode: "auto",
	},
	handle_links: "preferred",
	scope_extensions: [{ origin: "*.mikeodnis.dev" }],
	share_target: {
		action: "/create",
		method: "GET",
		params: {
			title: "title",
			text: "text",
			url: "url",
		},
	},
	icons: [
		{
			src: "/pwa/icon.svg",
			sizes: "any",
			type: "image/svg+xml",
			purpose: "any",
		},
		{
			src: "/pwa/icon-192.png",
			sizes: "192x192",
			type: "image/png",
			purpose: "any",
		},
		{
			src: "/pwa/icon-512.png",
			sizes: "512x512",
			type: "image/png",
			purpose: "any",
		},
		{
			src: "/pwa/maskable-192.png",
			sizes: "192x192",
			type: "image/png",
			purpose: "maskable",
		},
		{
			src: "/pwa/maskable-512.png",
			sizes: "512x512",
			type: "image/png",
			purpose: "maskable",
		},
	],
	shortcuts: [
		{
			name: "Create Link",
			short_name: "Create",
			description: "Shorten and security-verify a new URL",
			url: "/create",
			icons: [
				{
					src: "/pwa/icon-192.png",
					sizes: "192x192",
					type: "image/png",
				},
			],
		},
		{
			name: "Dashboard",
			short_name: "Dashboard",
			description: "Manage your short links and view click analytics",
			url: "/dashboard",
			icons: [
				{
					src: "/pwa/icon-192.png",
					sizes: "192x192",
					type: "image/png",
				},
			],
		},
		{
			name: "API Keys",
			short_name: "Keys",
			description: "Manage programmatic API keys",
			url: "/keys",
			icons: [
				{
					src: "/pwa/icon-192.png",
					sizes: "192x192",
					type: "image/png",
				},
			],
		},
	],
};

export const pwa: ModuleOptions = {
	registerType: "autoUpdate",
	scope: SCOPE,
	base: SCOPE,
	manifestFilename: "manifest.webmanifest",
	includeAssets: [
		"/favicon.ico",
		"/pwa/icon.svg",
		"/pwa/apple-touch-icon.png",
		"/pwa/icon-192.png",
		"/pwa/icon-512.png",
		"/pwa/maskable-192.png",
		"/pwa/maskable-512.png",
	],
	manifest: PWA_MANIFEST as NonNullable<ModuleOptions["manifest"]>,
	workbox: {
		globPatterns: ["**/*.{js,css,ico,png,svg,woff2}"],
		navigateFallback: null,
		cleanupOutdatedCaches: true,
		runtimeCaching: [
			{
				urlPattern: ({ url }: { url: URL }) =>
					url.origin === "https://fonts.googleapis.com" ||
					url.origin === "https://fonts.gstatic.com",
				handler: "CacheFirst",
				options: {
					cacheName: "google-fonts",
					expiration: {
						maxEntries: 20,
						maxAgeSeconds: 60 * 60 * 24 * 365,
					},
					cacheableResponse: {
						statuses: [0, 200],
					},
				},
			},
			{
				urlPattern: ({ url }: { url: URL }) =>
					url.pathname.startsWith("/pwa/") ||
					url.pathname.startsWith("/assets/"),
				handler: "StaleWhileRevalidate",
				options: {
					cacheName: "static-assets",
					expiration: {
						maxEntries: 64,
						maxAgeSeconds: 60 * 60 * 24 * 30,
					},
				},
			},
		],
	},
	client: {
		installPrompt: true,
		periodicSyncForUpdates: 3600,
	},
	devOptions: {
		enabled: false,
	},
};
