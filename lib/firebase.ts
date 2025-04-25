import { getAuth } from 'firebase-admin/auth';
import { Logger } from '.nuxt/imports.js';
import { initializeApp } from 'firebase-admin/app';
import { getDataConnect } from 'firebase-admin/data-connect';

import type { NuxtApp } from 'node_modules/nuxt/dist/app/nuxt.js';

export default defineNuxtPlugin((nuxtApp: NuxtApp) => {
  const config = useRuntimeConfig();

  const firebaseConfig = {
    apiKey: config.public.FB_API_KEY,
    authDomain: config.public.FB_AUTH_DOMAIN,
    projectId: config.public.FB_PROJECT_ID,
    storageBucket: config.public.FB_STORAGE_BUCKET,
    messagingSenderId: config.public.FB_MESSAGING_SENDER_ID,
    appId: config.public.FB_APP_ID,
    measurementId: config.public.FB_MEASUREMENT_ID
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const dataConnect = getDataConnect({
    serviceId: 'serviceId',
    location: 'us-west2'
  });

  nuxtApp.vueApp.provide('auth', auth);
  nuxtApp.provide('auth', auth);

  nuxtApp.vueApp.provide('dataConnect', dataConnect);
  nuxtApp.provide('dataConnect', dataConnect);


  return {
    provide: {
      auth,
      dataConnect
    }
  };
});