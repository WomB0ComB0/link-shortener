import type { ManifestOptions, VitePWAOptions } from 'node_modules/.deno/vite-plugin-pwa@1.0.0/node_modules/vite-plugin-pwa/dist/index.d.ts'
import type { ModuleOptions } from '@vite-pwa/nuxt'
import process from 'node:process'
import { app } from '../constants/index.js'

const scope = '/'

type ExtendedManifest = Omit<ManifestOptions, 'screenshots'> & {
  screenshots?: Array<{
    src: string;
    sizes: string;
    type: string;
    form_factor?: 'narrow' | 'wide';
  }>;
  tab_strip?: {
    [key: string]: {
      url: string;
      icons: Array<{
        src: string;
        sizes: string;
        type: string;
        purpose: string;
      }>;
    };
  };

  launch_handler?: {
    client_mode: 'auto' | 'focus-existing' | 'navigate-existing' | 'navigate-new';
    navigate_existing_client?: 'always' | 'never';
  };

  edge_side_panel?: {
    preferred_width?: number;
  };

  file_handlers?: Array<{
    action: string;
    accept: Record<string, string[]>;
    launch_type?: 'single-client' | 'multiple-clients';
  }>;

  protocol_handlers?: Array<{
    protocol: string;
    url: string;
    title?: string;
  }>;

  share_target?: {
    action: string;
    method: string;
    enctype?: string;
    params?: {
      title?: string;
      text?: string;
      url?: string;
      files?: Array<{
        name: string;
        accept: string[];
      }>;
    };
  };

  shortcuts_menu_items?: Array<{
    name: string;
    url: string;
    description?: string;
    icons?: Array<{
      src: string;
      sizes: string;
      type: string;
    }>;
  }>;

  widgets?: {
    [key: string]: {
      name: string;
      description: string;
      tag: string;
      ms_ac_template: string;
      data: string;
      type: string;
      screenshots: Array<{
        src: string;
        sizes: string;
        type: string;
        platform?: string;
      }>;
      icons: Array<{
        src: string;
        sizes: string;
        type: string;
      }>;
      auth?: boolean;
      update?: number;
    };
  };

  handle_links?: 'auto' | 'preferred' | 'not-preferred';

  scope_extensions?: Array<{
    origin: string;
  }>;

  note_taking?: {
    new_note_url: string;
  };
};

type PWA = ModuleOptions & Omit<VitePWAOptions, 'manifest'> & {
  manifest: ExtendedManifest;
}

export const pwa: PWA = {
  registerType: 'autoUpdate',
  scope,
  base: scope,
  manifest: {
    id: scope,
    scope,
    name: app.name,
    short_name: app.name,
    description: app.description,
    theme_color: '#ffffff',
    background_color: '#ffffff',
    display: 'standalone',
    orientation: 'portrait',
    start_url: scope,
    file_handlers: [],
    dir: 'ltr',
    lang: 'en',
    publicPath: scope,
    related_applications: [],
    prefer_related_applications: false,
    categories: [],
    iarc_rating_id: '',
    share_target: {
      action: '/',
      method: 'POST',
      enctype: 'multipart/form-data',
      params: {
        title: 'Kappa Theta Pi - National',
        text: 'Kappa Theta Pi (ΚΘΠ, also known as KTP) is a co-ed professional fraternity specializing in the field of information technology.',
        url: '/',
        files: [
          {
            name: 'images',
            accept: ['image/*'],
          },
          {
            name: 'documents',
            accept: ['application/pdf', '.doc', '.docx'],
          },
        ],
      },
    },
    handle_links: 'preferred',
    scope_extensions: [
      {
        origin: '*.kappathetapi.org',
      },
    ],
    edge_side_panel: {
      preferred_width: 480,
    },
    protocol_handlers: [
      {
        protocol: 'web+ktp',
        url: '/%s',
      },
      {
        protocol: 'web+rush',
        url: '/rush/%s',
      },
    ],
    tab_strip: {
      ktp_rush: {
        url: '/',
        icons: [
          {
            src: '/assets/svgs/logo.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      'ktp-rush-2': {
        url: '/',
        icons: [
          {
            src: '/assets/svgs/logo.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
    },
    launch_handler: {
      client_mode: 'auto',
    },
    icons: [
      {
        src: '/assets/svgs/logo.svg',
        type: 'image/svg+xml',
        sizes: 'any',
        purpose: 'maskable',
      },
      {
        src: '/pwa/android/android-launchericon-512-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/pwa/android/android-launchericon-192-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/pwa/windows11/SmallTile.scale-100.png',
        sizes: '71x71',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/SmallTile.scale-125.png',
        sizes: '89x89',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/SmallTile.scale-150.png',
        sizes: '107x107',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/SmallTile.scale-200.png',
        sizes: '142x142',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/SmallTile.scale-400.png',
        sizes: '284x284',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square150x150Logo.scale-100.png',
        sizes: '150x150',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square150x150Logo.scale-125.png',
        sizes: '188x188',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square150x150Logo.scale-150.png',
        sizes: '225x225',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square150x150Logo.scale-200.png',
        sizes: '300x300',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square150x150Logo.scale-400.png',
        sizes: '600x600',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Wide310x150Logo.scale-100.png',
        sizes: '310x150',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Wide310x150Logo.scale-125.png',
        sizes: '388x188',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Wide310x150Logo.scale-150.png',
        sizes: '465x225',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Wide310x150Logo.scale-200.png',
        sizes: '620x300',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Wide310x150Logo.scale-400.png',
        sizes: '1240x600',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/LargeTile.scale-100.png',
        sizes: '310x310',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/LargeTile.scale-125.png',
        sizes: '388x388',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/LargeTile.scale-150.png',
        sizes: '465x465',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/LargeTile.scale-200.png',
        sizes: '620x620',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/LargeTile.scale-400.png',
        sizes: '1240x1240',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.scale-100.png',
        sizes: '44x44',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.scale-125.png',
        sizes: '55x55',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.scale-150.png',
        sizes: '66x66',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.scale-200.png',
        sizes: '88x88',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.scale-400.png',
        sizes: '176x176',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/StoreLogo.scale-100.png',
        sizes: '50x50',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/StoreLogo.scale-125.png',
        sizes: '63x63',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/StoreLogo.scale-150.png',
        sizes: '75x75',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/StoreLogo.scale-200.png',
        sizes: '100x100',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/StoreLogo.scale-400.png',
        sizes: '200x200',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/SplashScreen.scale-100.png',
        sizes: '620x300',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/SplashScreen.scale-125.png',
        sizes: '775x375',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/SplashScreen.scale-150.png',
        sizes: '930x450',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/SplashScreen.scale-200.png',
        sizes: '1240x600',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/SplashScreen.scale-400.png',
        sizes: '2480x1200',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-16.png',
        sizes: '16x16',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-20.png',
        sizes: '20x20',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-24.png',
        sizes: '24x24',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-30.png',
        sizes: '30x30',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-32.png',
        sizes: '32x32',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-36.png',
        sizes: '36x36',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-40.png',
        sizes: '40x40',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-44.png',
        sizes: '44x44',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-48.png',
        sizes: '48x48',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-60.png',
        sizes: '60x60',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-64.png',
        sizes: '64x64',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-72.png',
        sizes: '72x72',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-80.png',
        sizes: '80x80',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-96.png',
        sizes: '96x96',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.targetsize-256.png',
        sizes: '256x256',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-16.png',
        sizes: '16x16',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-20.png',
        sizes: '20x20',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-24.png',
        sizes: '24x24',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-30.png',
        sizes: '30x30',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-32.png',
        sizes: '32x32',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-36.png',
        sizes: '36x36',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-40.png',
        sizes: '40x40',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-44.png',
        sizes: '44x44',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-48.png',
        sizes: '48x48',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-60.png',
        sizes: '60x60',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-64.png',
        sizes: '64x64',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-72.png',
        sizes: '72x72',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-80.png',
        sizes: '80x80',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-96.png',
        sizes: '96x96',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-unplated_targetsize-256.png',
        sizes: '256x256',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-16.png',
        sizes: '16x16',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-20.png',
        sizes: '20x20',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-24.png',
        sizes: '24x24',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-30.png',
        sizes: '30x30',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-32.png',
        sizes: '32x32',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-36.png',
        sizes: '36x36',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-40.png',
        sizes: '40x40',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-44.png',
        sizes: '44x44',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-48.png',
        sizes: '48x48',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-60.png',
        sizes: '60x60',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-64.png',
        sizes: '64x64',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-72.png',
        sizes: '72x72',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-80.png',
        sizes: '80x80',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-96.png',
        sizes: '96x96',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/windows11/Square44x44Logo.altform-lightunplated_targetsize-256.png',
        sizes: '256x256',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/16.png',
        sizes: '16x16',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/20.png',
        sizes: '20x20',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/29.png',
        sizes: '29x29',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/32.png',
        sizes: '32x32',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/40.png',
        sizes: '40x40',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/50.png',
        sizes: '50x50',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/57.png',
        sizes: '57x57',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/58.png',
        sizes: '58x58',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/60.png',
        sizes: '60x60',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/64.png',
        sizes: '64x64',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/72.png',
        sizes: '72x72',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/76.png',
        sizes: '76x76',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/80.png',
        sizes: '80x80',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/87.png',
        sizes: '87x87',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/100.png',
        sizes: '100x100',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/114.png',
        sizes: '114x114',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/120.png',
        sizes: '120x120',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/128.png',
        sizes: '128x128',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/144.png',
        sizes: '144x144',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/152.png',
        sizes: '152x152',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/167.png',
        sizes: '167x167',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/180.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/256.png',
        sizes: '256x256',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/ios/1024.png',
        sizes: '1024x1024',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,txt,png,ico,svg}'],
    navigateFallbackDenylist: [/^\/api\//],
    navigateFallback: '/',
    cleanupOutdatedCaches: true,
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts.googleapis.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-cache',
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        urlPattern: /^https:\/\/fonts.gstatic.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'gstatic-fonts-cache',
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
    ],
  },
  registerWebManifestInRouteRules: true,
  writePlugin: true,
  devOptions: {
    enabled: process.env.VITE_PLUGIN_PWA === 'true',
    navigateFallback: scope,
  },
}
