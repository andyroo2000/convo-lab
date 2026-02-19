const REFRESH_WINDOW_MS = 10 * 60 * 1000;

interface SignedToolAudioEntry {
  url: string;
  expiresAt: string;
}

interface SignedToolAudioResponse {
  urls: Record<string, SignedToolAudioEntry>;
}

interface CachedAudioUrl {
  url: string;
  expiresAtMs: number;
}

const signedUrlCache = new Map<string, CachedAudioUrl>();
let retryAfterFailureAtMs = 0;

const extractToolAudioPath = (value: string): string | null => {
  try {
    const parsed = new URL(value, window.location.origin);
    if (parsed.pathname.startsWith('/tools-audio/') && !parsed.search && !parsed.hash) {
      return parsed.pathname;
    }
    return null;
  } catch {
    return null;
  }
};

const isUsable = (cacheEntry: CachedAudioUrl, nowMs: number): boolean =>
  cacheEntry.expiresAtMs > nowMs;

const shouldRefresh = (cacheEntry: CachedAudioUrl, nowMs: number): boolean =>
  cacheEntry.expiresAtMs - nowMs <= REFRESH_WINDOW_MS;

async function fetchSignedUrls(paths: string[]): Promise<Record<string, SignedToolAudioEntry>> {
  const response = await fetch('/api/tools-audio/signed-urls', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paths }),
  });

  if (!response.ok) {
    throw new Error(`Failed to resolve signed audio URLs (${response.status})`);
  }

  const payload = (await response.json()) as SignedToolAudioResponse;
  return payload.urls || {};
}

export async function resolveToolAudioPlaybackUrls(urls: string[]): Promise<string[]> {
  const nowMs = Date.now();
  if (nowMs < retryAfterFailureAtMs) {
    return urls;
  }

  const pathsToResolve = Array.from(
    new Set(
      urls
        .map(extractToolAudioPath)
        .filter((path): path is string => Boolean(path))
        .filter((path) => {
          const cached = signedUrlCache.get(path);
          return !cached || !isUsable(cached, nowMs) || shouldRefresh(cached, nowMs);
        })
    )
  );

  if (pathsToResolve.length > 0) {
    try {
      const signedMap = await fetchSignedUrls(pathsToResolve);
      pathsToResolve.forEach((path) => {
        const signed = signedMap[path];
        if (signed?.url) {
          const expiresAtMs = Date.parse(signed.expiresAt);
          if (Number.isFinite(expiresAtMs)) {
            signedUrlCache.set(path, {
              url: signed.url,
              expiresAtMs,
            });
          }
        }
      });
    } catch {
      retryAfterFailureAtMs = Date.now() + 60 * 1000;
      return urls;
    }
  }

  return urls.map((url) => {
    const path = extractToolAudioPath(url);
    if (!path) {
      return url;
    }

    const cached = signedUrlCache.get(path);
    if (!cached || !isUsable(cached, Date.now())) {
      return url;
    }

    return cached.url;
  });
}

export function resetToolAudioUrlResolverCacheForTests(): void {
  signedUrlCache.clear();
  retryAfterFailureAtMs = 0;
}
