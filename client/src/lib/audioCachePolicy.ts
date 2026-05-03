const AUDIO_FILE_PATTERN = /\.(?:aac|flac|m4a|mp3|oga|ogg|opus|wav|weba)(?:$|[?#])/i;
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

const toUrl = (url: string | URL, baseHref: string) => {
  try {
    return url instanceof URL ? url : new URL(url, baseHref);
  } catch {
    return null;
  }
};

export const isSignedGoogleStorageUrlValue = (url: string | URL, baseHref: string) => {
  const parsed = toUrl(url, baseHref);
  if (!parsed || !GOOGLE_STORAGE_ORIGINS.has(parsed.origin)) return false;

  return GOOGLE_SIGNED_URL_PARAMS.some((param) => parsed.searchParams.has(param));
};

export const isStudyMediaApiUrl = (url: string | URL, baseHref: string) => {
  const parsed = toUrl(url, baseHref);
  return Boolean(parsed?.pathname.startsWith('/api/study/media/'));
};

export const shouldPreloadAudioCacheUrl = (url: string | URL, baseHref: string) => {
  const parsed = toUrl(url, baseHref);
  if (!parsed) return false;
  if (isSignedGoogleStorageUrlValue(parsed, baseHref)) return false;
  if (isStudyMediaApiUrl(parsed, baseHref)) return false;

  return true;
};

export const getAudioCachePreloadMode = (
  url: string | URL,
  baseHref: string,
  canWarmAudioCache: boolean
): 'auto' | 'metadata' | 'none' => {
  if (!shouldPreloadAudioCacheUrl(url, baseHref)) return 'none';
  return canWarmAudioCache ? 'auto' : 'metadata';
};

export const normalizeWarmableAudioUrls = (
  urls: Array<string | null | undefined>,
  baseHref: string
) => {
  const baseUrl = new URL(baseHref);

  return Array.from(
    new Set(
      urls
        .filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
        .map((url) => toUrl(url, baseUrl.href))
        .filter((url): url is URL => Boolean(url))
        .filter((url) => url.origin === baseUrl.origin)
        .filter((url) => shouldPreloadAudioCacheUrl(url, baseUrl.href))
        .map((url) => url.href)
    )
  );
};

export const normalizeServiceWorkerAudioMessageUrls = (urls: unknown, baseHref: string) => {
  if (!Array.isArray(urls)) return [];

  return normalizeWarmableAudioUrls(
    urls.filter((url): url is string => typeof url === 'string'),
    baseHref
  );
};

export const isServiceWorkerAudioRoute = ({
  request,
  sameOrigin,
  url,
}: {
  request: Request;
  sameOrigin: boolean;
  url: URL;
}) => {
  if (!sameOrigin) return false;
  if (!shouldPreloadAudioCacheUrl(url, url.origin)) return false;
  if (request.destination === 'audio') return true;
  if (url.pathname.startsWith('/audio/')) return true;
  if (url.pathname.startsWith('/voice-previews/')) return true;
  if (AUDIO_FILE_PATTERN.test(url.pathname)) return true;

  return false;
};
