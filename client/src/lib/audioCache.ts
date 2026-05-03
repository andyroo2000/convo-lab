import {
  getAudioCachePreloadMode,
  isSignedGoogleStorageUrlValue,
  normalizeWarmableAudioUrls,
  shouldPreloadAudioCacheUrl,
} from './audioCachePolicy';

const PRECACHE_AUDIO_MESSAGE = 'PRECACHE_AUDIO_URLS';
const CLEAR_AUDIO_CACHE_MESSAGE = 'CLEAR_AUDIO_CACHE';
const AUDIO_CACHE_READY_TIMEOUT_MS = 1200;

type AudioCacheMessage =
  | { type: typeof PRECACHE_AUDIO_MESSAGE; urls: string[] }
  | { type: typeof CLEAR_AUDIO_CACHE_MESSAGE };

interface NetworkInformationLike {
  effectiveType?: string;
  saveData?: boolean;
}

const getConnection = (): NetworkInformationLike | null => {
  if (typeof navigator === 'undefined') return null;

  const nav = navigator as Navigator & {
    connection?: NetworkInformationLike;
    mozConnection?: NetworkInformationLike;
    webkitConnection?: NetworkInformationLike;
  };

  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
};

export const shouldWarmAudioCache = () => {
  const connection = getConnection();
  if (!connection) return true;
  if (connection.saveData) return false;

  return !['slow-2g', '2g'].includes(String(connection.effectiveType ?? '').toLowerCase());
};

export const isSignedGoogleStorageUrl = (url: string) => {
  if (typeof window === 'undefined') return false;

  return isSignedGoogleStorageUrlValue(url, window.location.href);
};

export const shouldPreloadAudioUrl = (url: string) => {
  if (typeof window === 'undefined') return false;

  return shouldPreloadAudioCacheUrl(url, window.location.href);
};

export const getAudioPreloadMode = (url: string): 'auto' | 'metadata' | 'none' => {
  if (typeof window === 'undefined') return 'none';

  return getAudioCachePreloadMode(url, window.location.href, shouldWarmAudioCache());
};

export const normalizeAudioCacheUrls = (urls: Array<string | null | undefined>) => {
  if (typeof window === 'undefined') return [];

  return normalizeWarmableAudioUrls(urls, window.location.href);
};

const timeout = (ms: number) =>
  new Promise<null>((resolve) => {
    window.setTimeout(() => resolve(null), ms);
  });

const getServiceWorkerTarget = async (): Promise<ServiceWorker | null> => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  if (navigator.serviceWorker.controller) {
    return navigator.serviceWorker.controller;
  }

  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    timeout(AUDIO_CACHE_READY_TIMEOUT_MS),
  ]);

  return registration?.active ?? null;
};

const postServiceWorkerMessage = async (message: AudioCacheMessage) => {
  const target = await getServiceWorkerTarget();
  if (!target) return false;

  target.postMessage(message);
  return true;
};

const fetchAudioUrls = async (urls: string[]) => {
  await Promise.allSettled(
    urls.map((url) => {
      const parsed = new URL(url, window.location.href);
      const sameOrigin = parsed.origin === window.location.origin;

      return fetch(parsed.href, {
        cache: 'force-cache',
        credentials: sameOrigin ? 'include' : 'omit',
      });
    })
  );
};

export async function warmAudioCache(
  urls: Array<string | null | undefined>,
  options: { respectConnection?: boolean } = {}
) {
  const normalizedUrls = normalizeAudioCacheUrls(urls);
  if (normalizedUrls.length === 0) return;

  const respectConnection = options.respectConnection ?? true;
  if (respectConnection && !shouldWarmAudioCache()) return;

  const sentToServiceWorker = await postServiceWorkerMessage({
    type: PRECACHE_AUDIO_MESSAGE,
    urls: normalizedUrls,
  });

  if (!sentToServiceWorker) {
    await fetchAudioUrls(normalizedUrls);
  }
}

export async function clearAudioCache() {
  await postServiceWorkerMessage({ type: CLEAR_AUDIO_CACHE_MESSAGE });

  if (typeof caches !== 'undefined') {
    await caches.delete('audio-cache');
  }
}
