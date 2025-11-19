import { pwa } from "./app/config/pwa";
import { app } from "./app/constants/index";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: "2024-11-01",
	devtools: { enabled: true },

	modules: [
		"@nuxt/fonts",
		"@nuxt/icon",
		"@nuxt/image",
		"@nuxt/ui",
		"@nuxt/test-utils",
		"@nuxt/scripts",
		"@vueuse/nuxt",
		"@vite-pwa/nuxt",
	] as const as string[],

	css: ["./app/assets/css/main.css"],

	runtimeConfig: {
		MASTER_PASSWORD_HASH: process.env.MASTER_PASSWORD_HASH,
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
			viewport: "width=device-width,initial-scale=1",
			link: [
				{ rel: "icon", href: "/favicon.ico", sizes: "any" },
				{ rel: "icon", type: "image/svg+xml", href: "/assets/svgs/logo.svg" },
				{ rel: "apple-touch-icon", href: "/pwa/ios/180.png" },
				{ rel: "mask-icon", href: "/assets/svgs/logo.svg", color: "oklch(52% 0.12 285deg)" },
			],
			script: [
				{ src: "https://cdn.tailwindcss.com", defer: true },
				{
					src: "https://cloud.umami.is/script.js",
					defer: true,
					"data-website-id": "e7be89ea-5e5f-463b-97c3-95457c7cb00a",
				},
			],
			meta: [
				{ name: "viewport", content: "width=device-width, initial-scale=1" },
				{ name: "description", content: app.description },
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
					content: app.name,
				},
				{
					name: "mobile-web-app-capable",
					content: "yes",
				},
				{
					name: "theme-color",
					media: "(prefers-color-scheme: light)",
					content: "#ffffff",
				},
				{
					name: "theme-color",
					media: "(prefers-color-scheme: dark)",
					content: "#1a1a1a",
				},
				{
					name: "msapplication-TileColor",
					content: "oklch(52% 0.12 285deg)",
				},
				{
					name: "msapplication-config",
					content: "/pwa/browserconfig.xml",
				},
			],
		},
	},

	colorMode: {
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
		prerender: {
			crawlLinks: false,
			routes: ["/"],
			ignore: ["/hi"], // TODO: 🚩
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

	...(pwa as any),
});
