/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { RangeRequestsPlugin } from 'workbox-range-requests';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<import('workbox-precaching').PrecacheEntry | string>;
  __WB_DISABLE_DEV_LOGS?: boolean;
};

const AUDIO_CACHE_NAME = 'audio-cache';
const AUDIO_FILE_PATTERN = /\.(?:aac|flac|m4a|mp3|oga|ogg|opus|wav|weba)(?:$|[?#])/i;
const AUDIO_MESSAGE_TYPES = new Set(['PRECACHE_AUDIO_URLS', 'CLEAR_AUDIO_CACHE']);
const GOOGLE_SIGNED_URL_PARAMS = new Set(['X-Goog-Signature', 'X-Goog-Expires']);
const GOOGLE_STORAGE_ORIGINS = new Set([
  'https://storage.googleapis.com',
  'https://storage.cloud.google.com',
]);

self.__WB_DISABLE_DEV_LOGS = true;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

precacheAndRoute(self.__WB_MANIFEST);

const isAudioRequest = (request: Request, url: URL) => {
  const isSignedGoogleStorageUrl =
    GOOGLE_STORAGE_ORIGINS.has(url.origin) &&
    Array.from(GOOGLE_SIGNED_URL_PARAMS).some((param) => url.searchParams.has(param));

  if (isSignedGoogleStorageUrl) return false;
  if (request.destination === 'audio') return true;
  if (url.pathname.startsWith('/api/study/media/')) return true;
  if (url.pathname.startsWith('/audio/')) return true;
  if (url.pathname.startsWith('/voice-previews/')) return true;
  if (AUDIO_FILE_PATTERN.test(url.pathname)) return true;

  return false;
};

const audioStrategy = new CacheFirst({
  cacheName: AUDIO_CACHE_NAME,
  plugins: [
    new ExpirationPlugin({
      maxEntries: 300,
      maxAgeSeconds: 60 * 60 * 24 * 60,
      purgeOnQuotaError: true,
    }),
    new CacheableResponsePlugin({
      statuses: [0, 200],
    }),
    new RangeRequestsPlugin(),
  ],
});

registerRoute(({ request, url }) => isAudioRequest(request, url), audioStrategy);

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

const normalizeMessageUrls = (urls: unknown) => {
  if (!Array.isArray(urls)) return [];

  return Array.from(
    new Set(
      urls
        .filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
        .map((url) => new URL(url, self.location.origin).href)
    )
  );
};

const precacheAudioUrls = async (event: ExtendableMessageEvent, urls: string[]) => {
  await Promise.allSettled(
    urls.map(async (url) => {
      const requestUrl = new URL(url);
      const sameOrigin = requestUrl.origin === self.location.origin;
      const request = new Request(requestUrl.href, {
        credentials: sameOrigin ? 'include' : 'omit',
        mode: sameOrigin ? 'same-origin' : 'no-cors',
      });

      await audioStrategy.handle({ event, request });
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

  const urls = normalizeMessageUrls('urls' in data ? data.urls : []);
  if (urls.length === 0) return;

  event.waitUntil(precacheAudioUrls(event, urls));
});
