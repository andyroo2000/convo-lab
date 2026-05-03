/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { RangeRequestsPlugin } from 'workbox-range-requests';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';

import {
  isServiceWorkerAudioRoute,
  normalizeServiceWorkerAudioMessageUrls,
} from './lib/audioCachePolicy';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<import('workbox-precaching').PrecacheEntry | string>;
  __WB_DISABLE_DEV_LOGS?: boolean;
};

const AUDIO_CACHE_NAME = 'audio-cache';
const AUDIO_MESSAGE_TYPES = new Set(['PRECACHE_AUDIO_URLS', 'CLEAR_AUDIO_CACHE']);

self.__WB_DISABLE_DEV_LOGS = true;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

precacheAndRoute(self.__WB_MANIFEST);

const audioStrategy = new CacheFirst({
  cacheName: AUDIO_CACHE_NAME,
  plugins: [
    new ExpirationPlugin({
      maxEntries: 150,
      maxAgeSeconds: 60 * 60 * 24 * 60,
      purgeOnQuotaError: true,
    }),
    new CacheableResponsePlugin({
      statuses: [0, 200],
    }),
    new RangeRequestsPlugin(),
  ],
});

registerRoute(
  ({ request, url, sameOrigin }) => isServiceWorkerAudioRoute({ request, url, sameOrigin }),
  audioStrategy
);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 10,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 5,
      }),
    ],
  })
);

registerRoute(
  ({ url }) => url.pathname.startsWith('/assets/') && /\.(js|css)$/.test(url.pathname),
  new NetworkFirst({
    cacheName: 'assets-cache',
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

const precacheAudioUrls = async (event: ExtendableMessageEvent, urls: string[]) => {
  await Promise.allSettled(
    urls.map(async (url) => {
      const requestUrl = new URL(url);
      const sameOrigin = requestUrl.origin === self.location.origin;
      const request = new Request(requestUrl.href, {
        credentials: sameOrigin ? 'include' : 'omit',
        mode: sameOrigin ? 'same-origin' : 'no-cors',
      });

      const [responseDone, cacheDone] = audioStrategy.handleAll({ event, request });
      await responseDone;
      await cacheDone;
    })
  );
};

self.addEventListener('message', (event) => {
  const { data } = event;
  if (!data || typeof data !== 'object' || !('type' in data)) return;

  const type = String(data.type);
  if (!AUDIO_MESSAGE_TYPES.has(type)) return;

  if (type === 'CLEAR_AUDIO_CACHE') {
    event.waitUntil(caches.delete(AUDIO_CACHE_NAME));
    return;
  }

  const urls = normalizeServiceWorkerAudioMessageUrls(
    'urls' in data ? data.urls : [],
    self.location.origin
  );
  if (urls.length === 0) return;

  event.waitUntil(precacheAudioUrls(event, urls));
});
