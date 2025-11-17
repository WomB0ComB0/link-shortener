import { pwa } from "./app/config/pwa";
import { app } from "./app/constants/index";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: "2024-11-01",
	devtools: { enabled: true },

	modules: [
		"@unocss/nuxt",
		"@nuxt/fonts",
		"@nuxt/icon",
		"@nuxt/image",
		"@nuxt/ui",
		"@nuxt/test-utils",
		"@nuxt/scripts",
		"@vueuse/nuxt",
		"@vite-pwa/nuxt",
	] as const as string[],

	css: ["./app/assets/css/colors.css"],

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
				{ rel: "icon", type: "image/svg+xml", href: "/nuxt.svg" },
				{ rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
			],
			meta: [
				{ name: "viewport", content: "width=device-width, initial-scale=1" },
				{ name: "description", content: app.description },
				{
					name: "apple-mobile-web-app-status-bar-style",
					content: "black-translucent",
				},
				{
					name: "theme-color",
					media: "(prefers-color-scheme: light)",
					content: "white",
				},
				{
					name: "theme-color",
					media: "(prefers-color-scheme: dark)",
					content: "#222222",
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

	...(pwa as any),
});
