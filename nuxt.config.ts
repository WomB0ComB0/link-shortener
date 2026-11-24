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

import { pwa, THEME_COLOR } from "./app/config/pwa";
import { app } from "./app/constants/index";

const DEFAULT_OG_IMAGE = `${app.url}/opengraph-image`;
const DEFAULT_TWITTER_IMAGE = `${app.url}/twitter-image`;
const DEFAULT_OG_ALT = `${app.name} — ${app.description}`;

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: "2024-11-01",
	devtools: { enabled: true },

	modules: [
		"@nuxt/fonts",
		"@nuxt/icon",
		"@nuxt/ui",
		"@vite-pwa/nuxt",
	] as const as string[],

	css: ["~/assets/css/main.css"],

	fonts: {
		families: [
			{
				name: "Geist",
				provider: "google",
				weights: [400, 500, 600, 700],
			},
			{
				name: "Geist Mono",
				provider: "google",
				weights: [400, 500, 600],
			},
		],
	},

	runtimeConfig: {
		MASTER_PASSWORD_HASH: process.env.MASTER_PASSWORD_HASH,
		JWT_SECRET: process.env.JWT_SECRET,
		hasuraGraphqlEndpoint: process.env.HASURA_GRAPHQL_ENDPOINT,
		hasuraGraphqlAdminSecret: process.env.HASURA_GRAPHQL_ADMIN_SECRET,
		public: {
			FB_API_KEY: process.env.NUXT_PUBLIC_FB_API_KEY,
			FB_AUTH_DOMAIN: process.env.NUXT_PUBLIC_FB_AUTH_DOMAIN,
			FB_PROJECT_ID: process.env.NUXT_PUBLIC_FB_PROJECT_ID,
			FB_STORAGE_BUCKET: process.env.NUXT_PUBLIC_FB_STORAGE_BUCKET,
			FB_MESSAGING_SENDER_ID: process.env.NUXT_PUBLIC_FB_MESSAGING_SENDER_ID,
			FB_APP_ID: process.env.NUXT_PUBLIC_FB_APP_ID,
			FB_MEASUREMENT_ID: process.env.NUXT_PUBLIC_FB_MEASUREMENT_ID,
		},
	},

	app: {
		head: {
			htmlAttrs: {
				lang: "en",
				class: "dark",
			},
			viewport: "width=device-width,initial-scale=1,viewport-fit=cover",
			link: [
				{ rel: "icon", href: "/favicon.ico", sizes: "any" },
				{ rel: "icon", type: "image/svg+xml", href: "/pwa/icon.svg" },
				{ rel: "apple-touch-icon", href: "/pwa/apple-touch-icon.png" },
				{ rel: "mask-icon", href: "/pwa/icon.svg", color: THEME_COLOR },
				{ rel: "manifest", href: "/manifest.webmanifest" },
				{
					rel: "alternate",
					type: "text/plain",
					href: "/llms.txt",
					title: "LLM-friendly site index",
				},
			],
			script: [
				{
					src: "https://cloud.umami.is/script.js",
					defer: true,
					"data-website-id": "e7be89ea-5e5f-463b-97c3-95457c7cb00a",
				},
			],
			meta: [
				{ name: "description", content: app.description },
				{ name: "author", content: "Mike Odnis" },
				{
					name: "robots",
					content:
						"index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
				},
				{ name: "color-scheme", content: "dark" },
				{ property: "og:site_name", content: app.name },
				{ property: "og:type", content: "website" },
				{ property: "og:url", content: app.url },
				{ property: "og:title", content: app.name },
				{ property: "og:description", content: app.description },
				{ property: "og:image", content: DEFAULT_OG_IMAGE },
				{ property: "og:image:width", content: "1200" },
				{ property: "og:image:height", content: "630" },
				{ property: "og:image:type", content: "image/png" },
				{ property: "og:image:alt", content: DEFAULT_OG_ALT },
				{ name: "twitter:card", content: "summary_large_image" },
				{ name: "twitter:title", content: app.name },
				{ name: "twitter:description", content: app.description },
				{ name: "twitter:image", content: DEFAULT_TWITTER_IMAGE },
				{ name: "twitter:image:alt", content: DEFAULT_OG_ALT },
				{ name: "twitter:creator", content: "@mike_odnis" },
				{
					name: "apple-mobile-web-app-status-bar-style",
					content: "black-translucent",
				},
				{
					name: "apple-mobile-web-app-capable",
					content: "yes",
				},
				{
					name: "apple-mobile-web-app-title",
					content: app.shortName,
				},
				{
					name: "mobile-web-app-capable",
					content: "yes",
				},
				{
					name: "theme-color",
					content: THEME_COLOR,
				},
				{
					name: "msapplication-TileColor",
					content: THEME_COLOR,
				},
				{
					name: "msapplication-config",
					content: "/pwa/browserconfig.xml",
				},
			],
		},
	},

	colorMode: {
		preference: "dark",
		fallback: "dark",
		classSuffix: "",
	},

	future: {
		compatibilityVersion: 4,
	},

	experimental: {
		payloadExtraction: false,
		renderJsonPayloads: true,
		typedPages: true,
	},

	nitro: {
		esbuild: {
			options: {
				target: "esnext",
			},
		},
		publicAssets: [
			{
				dir: "server/og/fonts",
				baseURL: "/assets/fonts/og",
				maxAge: 60 * 60 * 24 * 365,
			},
		],
		serverAssets: [
			{
				baseName: "og-fonts",
				dir: "./og/fonts",
			},
		],
		prerender: {
			crawlLinks: false,
			routes: [],
			ignore: ["/hi"],
		},
	},

	ui: {
		theme: {
			colors: [
				"primary",
				"secondary",
				"tertiary",
				"info",
				"success",
				"warning",
				"error",
				"neutral",
			],
		},
	},

	pwa,
});
