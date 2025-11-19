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

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDataConnect } from "firebase-admin/data-connect";
import type { NuxtApp } from "node_modules/nuxt/dist/app/nuxt.js";
import { Logger } from "~/utils";

export default defineNuxtPlugin((nuxtApp: NuxtApp) => {
	const logger = Logger.getLogger("Firebase");
	const config = useRuntimeConfig();

	logger.debug("Initializing Firebase plugin");

	const firebaseConfig = {
		apiKey: config.public.FB_API_KEY,
		authDomain: config.public.FB_AUTH_DOMAIN,
		projectId: config.public.FB_PROJECT_ID,
		storageBucket: config.public.FB_STORAGE_BUCKET,
		messagingSenderId: config.public.FB_MESSAGING_SENDER_ID,
		appId: config.public.FB_APP_ID,
		measurementId: config.public.FB_MEASUREMENT_ID,
	};

	try {
		logger.info("Configuring Firebase app");
		const app = initializeApp(firebaseConfig);
		const auth = getAuth(app);
		const dataConnect = getDataConnect({
			serviceId: "serviceId",
			location: "us-west2",
		});

		logger.debug("Providing Firebase services to Nuxt app");
		nuxtApp.vueApp.provide("auth", auth);
		nuxtApp.provide("auth", auth);

		nuxtApp.vueApp.provide("dataConnect", dataConnect);
		nuxtApp.provide("dataConnect", dataConnect);

		logger.success("Firebase initialization complete");

		return {
			provide: {
				auth,
				dataConnect,
			},
		};
	} catch (error) {
		logger.error("Failed to initialize Firebase", error);
		throw error;
	}
});
