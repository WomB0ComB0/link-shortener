declare global {
	namespace NodeJS {
		interface ProcessEnv {
			NUXT_PUBLIC_FB_API_KEY: string;
			NUXT_PUBLIC_FB_AUTH_DOMAIN: string;
			NUXT_PUBLIC_FB_PROJECT_ID: string;
			NUXT_PUBLIC_FB_STORAGE_BUCKET: string;
			NUXT_PUBLIC_FB_MESSAGING_SENDER_ID: string;
			NUXT_PUBLIC_FB_APP_ID: string;
			NUXT_PUBLIC_FB_MEASUREMENT_ID: string;
			DATABASE_URL: string;
			HASURA_GRAPHQL_ENDPOINT: string;
			HASURA_GRAPHQL_ADMIN_SECRET: string;
			UPSTASH_REDIS_REST_URL: string;
			UPSTASH_REDIS_REST_TOKEN: string;
			MASTER_PASSWORD_HASH: string;
			NODE_ENV: string;
			BASE_URL: string;
			JWT_SECRET: string;
			GOOGLE_SAFE_BROWSING_API_KEY: string;
			ADMIN_BYPASS_SECRET: string;
			SECURITY_VERIFICATION_ENABLED: string;
			SECURITY_CACHE_TTL: string;
			SECURITY_CHECK_TIMEOUT: string;
		}
	}
}
export {};
