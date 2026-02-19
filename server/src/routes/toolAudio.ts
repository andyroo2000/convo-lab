import { type Request, Router } from 'express';

import { gcsFileExists, getSignedReadUrl } from '../services/storageClient.js';

const router = Router();

const TOOLS_AUDIO_PATH_PATTERN = /^\/tools-audio\/[a-zA-Z0-9/_-]+\.mp3$/;
const DEFAULT_TTL_SECONDS = 12 * 60 * 60;
const MIN_TTL_SECONDS = 5 * 60;
const MAX_TTL_SECONDS = 24 * 60 * 60;
const MAX_PATHS_PER_REQUEST = 60;
const MAX_PATH_LENGTH = 300;
const DEFAULT_SIGNED_URL_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const DEFAULT_SIGNED_URL_RATE_LIMIT_MAX_REQUESTS = 120;
const MAX_SIGNED_URL_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MAX_SIGNED_URL_RATE_LIMIT_MAX_REQUESTS = 5000;

type RateLimitEntry = {
  windowStartMs: number;
  requestCount: number;
};

interface SignedUrlRequestBody {
  paths?: unknown;
}

const toPathArray = (value: unknown): string[] | null => {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_PATHS_PER_REQUEST) {
    return null;
  }

  const normalized = value.map((item) => {
    if (typeof item !== 'string') {
      return null;
    }

    const trimmed = item.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_PATH_LENGTH) {
      return null;
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed, 'https://convo-lab.local');
    } catch {
      return null;
    }

    const pathname = parsed.pathname;
    if (parsed.search || parsed.hash) {
      return null;
    }

    if (
      !TOOLS_AUDIO_PATH_PATTERN.test(pathname) ||
      pathname.includes('..') ||
      pathname.includes('\\')
    ) {
      return null;
    }

    return pathname;
  });

  if (normalized.some((item) => item === null)) {
    return null;
  }

  return Array.from(new Set(normalized as string[]));
};

const signedUrlRateLimitByIp = new Map<string, RateLimitEntry>();

const parseEnvInteger = (
  rawValue: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
): number => {
  const parsed = Number.parseInt(rawValue ?? `${fallback}`, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, minimum), maximum);
};

const getSignedUrlRateLimitConfig = () => ({
  windowMs: parseEnvInteger(
    process.env.TOOLS_AUDIO_SIGNED_URL_RATE_LIMIT_WINDOW_MS,
    DEFAULT_SIGNED_URL_RATE_LIMIT_WINDOW_MS,
    1000,
    MAX_SIGNED_URL_RATE_LIMIT_WINDOW_MS
  ),
  maxRequests: parseEnvInteger(
    process.env.TOOLS_AUDIO_SIGNED_URL_RATE_LIMIT_MAX_REQUESTS,
    DEFAULT_SIGNED_URL_RATE_LIMIT_MAX_REQUESTS,
    1,
    MAX_SIGNED_URL_RATE_LIMIT_MAX_REQUESTS
  ),
});

const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];

  if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
    return forwarded.split(',')[0].trim();
  }

  if (Array.isArray(forwarded) && forwarded.length > 0 && forwarded[0].trim().length > 0) {
    return forwarded[0].trim();
  }

  return req.ip || 'unknown';
};

const applySignedUrlRateLimit = (
  ip: string,
  nowMs: number,
  windowMs: number,
  maxRequests: number
): boolean => {
  const existingEntry = signedUrlRateLimitByIp.get(ip);
  if (!existingEntry || nowMs - existingEntry.windowStartMs >= windowMs) {
    signedUrlRateLimitByIp.set(ip, { windowStartMs: nowMs, requestCount: 1 });
    return false;
  }

  if (existingEntry.requestCount >= maxRequests) {
    return true;
  }

  existingEntry.requestCount += 1;
  return false;
};

const pruneRateLimitEntries = (nowMs: number, windowMs: number) => {
  // Keep memory usage bounded for unauthenticated clients hitting this endpoint.
  if (signedUrlRateLimitByIp.size < 1000) {
    return;
  }

  signedUrlRateLimitByIp.forEach((entry, ip) => {
    if (nowMs - entry.windowStartMs >= windowMs) {
      signedUrlRateLimitByIp.delete(ip);
    }
  });
};

const parseTtlSeconds = (): number => {
  const rawValue = Number.parseInt(
    process.env.TOOLS_AUDIO_SIGNED_URL_TTL_SECONDS ?? `${DEFAULT_TTL_SECONDS}`,
    10
  );

  if (!Number.isFinite(rawValue)) {
    return DEFAULT_TTL_SECONDS;
  }

  return Math.max(MIN_TTL_SECONDS, Math.min(MAX_TTL_SECONDS, rawValue));
};

const shouldSignAudioUrls = (): boolean => {
  const explicit = process.env.TOOLS_AUDIO_SIGNED_URLS_ENABLED?.toLowerCase();
  if (explicit === 'true') {
    return true;
  }
  if (explicit === 'false') {
    return false;
  }

  return Boolean(process.env.GCS_BUCKET_NAME);
};

const toBucketObjectPath = (requestPath: string): string => {
  const root = (process.env.TOOLS_AUDIO_GCS_ROOT || 'tools-audio').replace(/^\/+|\/+$/g, '');
  const relativePath = requestPath.replace(/^\/tools-audio\//, '');
  return `${root}/${relativePath}`;
};

// Public-by-design endpoint for static practice audio; constrained by strict path
// validation, file allowlisting, and per-IP rate limiting.
router.post('/signed-urls', async (req, res) => {
  const { maxRequests, windowMs } = getSignedUrlRateLimitConfig();
  const nowMs = Date.now();
  const clientIp = getClientIp(req);

  pruneRateLimitEntries(nowMs, windowMs);
  if (applySignedUrlRateLimit(clientIp, nowMs, windowMs, maxRequests)) {
    return res.status(429).json({
      error: 'Too many signed-url requests. Please retry shortly.',
    });
  }

  const body = req.body as SignedUrlRequestBody | null;
  const paths = toPathArray(body?.paths);

  if (!paths) {
    return res.status(400).json({
      error: `paths must be an array of 1-${MAX_PATHS_PER_REQUEST} valid /tools-audio/*.mp3 values`,
    });
  }

  const ttlSeconds = parseTtlSeconds();
  const defaultExpiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  if (!shouldSignAudioUrls()) {
    return res.json({
      mode: 'passthrough',
      ttlSeconds,
      urls: Object.fromEntries(
        paths.map((path) => [path, { url: path, expiresAt: defaultExpiresAt }])
      ),
    });
  }

  const resolvedEntries = await Promise.all(
    paths.map(async (path) => {
      try {
        const bucketPath = toBucketObjectPath(path);
        const exists = await gcsFileExists(bucketPath);
        if (!exists) {
          return [path, { url: path, expiresAt: defaultExpiresAt }] as const;
        }

        const signed = await getSignedReadUrl({
          filePath: bucketPath,
          expiresInSeconds: ttlSeconds,
        });
        return [path, signed] as const;
      } catch (error) {
        console.warn(`[Tool Audio] Signed URL fallback for ${path}:`, error);
        return [path, { url: path, expiresAt: defaultExpiresAt }] as const;
      }
    })
  );

  return res.json({
    mode: 'signed',
    ttlSeconds,
    urls: Object.fromEntries(resolvedEntries),
  });
});

export function resetToolAudioRateLimitForTests(): void {
  signedUrlRateLimitByIp.clear();
}

export default router;
