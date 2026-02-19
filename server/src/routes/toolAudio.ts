import { Router } from 'express';

import { gcsFileExists, getSignedReadUrl } from '../services/storageClient.js';

const router = Router();

const TOOLS_AUDIO_PATH_PATTERN = /^\/tools-audio\/[a-zA-Z0-9/_-]+\.mp3$/;
const DEFAULT_TTL_SECONDS = 12 * 60 * 60;
const MIN_TTL_SECONDS = 5 * 60;
const MAX_TTL_SECONDS = 24 * 60 * 60;
const MAX_PATHS_PER_REQUEST = 60;
const MAX_PATH_LENGTH = 300;

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

router.post('/signed-urls', async (req, res) => {
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

export default router;
