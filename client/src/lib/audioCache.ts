const PRECACHE_AUDIO_MESSAGE = 'PRECACHE_AUDIO_URLS';
const CLEAR_AUDIO_CACHE_MESSAGE = 'CLEAR_AUDIO_CACHE';
const AUDIO_CACHE_READY_TIMEOUT_MS = 1200;
const GOOGLE_SIGNED_URL_PARAMS = [
  'X-Goog-Algorithm',
  'X-Goog-Credential',
  'X-Goog-Expires',
  'X-Goog-Signature',
] as const;
const GOOGLE_STORAGE_ORIGINS = new Set([
  'https://storage.googleapis.com',
  'https://storage.cloud.google.com',
]);

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

  try {
    const parsed = new URL(url, window.location.href);
    if (!GOOGLE_STORAGE_ORIGINS.has(parsed.origin)) return false;

    return GOOGLE_SIGNED_URL_PARAMS.some((param) => parsed.searchParams.has(param));
  } catch {
    return false;
  }
};

export const shouldPreloadAudioUrl = (url: string) => !isSignedGoogleStorageUrl(url);

export const getAudioPreloadMode = (url: string): 'auto' | 'metadata' | 'none' => {
  if (!shouldPreloadAudioUrl(url)) return 'none';
  return shouldWarmAudioCache() ? 'auto' : 'metadata';
};

export const normalizeAudioCacheUrls = (urls: Array<string | null | undefined>) => {
  if (typeof window === 'undefined') return [];

  return Array.from(
    new Set(
      urls
        .filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
        .map((url) => new URL(url, window.location.href))
        .filter((url) => url.origin === window.location.origin)
        .map((url) => url.href)
        .filter((url) => !isSignedGoogleStorageUrl(url))
    )
  );
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
