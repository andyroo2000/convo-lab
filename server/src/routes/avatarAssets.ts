import { Router } from 'express';

import { isLearningOsStaticMediaProxyEnabled } from '../config/staticMediaRouting.js';
import { AppError } from '../middleware/errorHandler.js';
import { fetchLearningOsStaticMedia } from '../services/learningOsStaticMediaProxy.js';
import { gcsFileExists, getSignedReadUrl } from '../services/storageClient.js';

const router = Router();

const AVATAR_PATH_PATTERN = /^(?:voices\/)?[a-z]{2}-[a-z0-9-]+\.jpg(?![\s\S])/;
const LOCAL_AVATAR_LOCATION_PATTERN = /^\/avatars\/(?:voices\/)?[a-z]{2}-[a-z0-9-]+\.jpg(?![\s\S])/;
const DEFAULT_TTL_SECONDS = 12 * 60 * 60;
const MIN_TTL_SECONDS = 5 * 60;
const MAX_TTL_SECONDS = 24 * 60 * 60;

const parseTtlSeconds = (): number => {
  const rawValue = Number.parseInt(
    process.env.AVATAR_SIGNED_URL_TTL_SECONDS ?? `${DEFAULT_TTL_SECONDS}`,
    10
  );

  if (!Number.isFinite(rawValue)) {
    return DEFAULT_TTL_SECONDS;
  }

  return Math.max(MIN_TTL_SECONDS, Math.min(MAX_TTL_SECONDS, rawValue));
};

const shouldSignAvatarUrls = (): boolean => {
  const explicit = process.env.AVATAR_SIGNED_URLS_ENABLED?.toLowerCase();
  if (explicit === 'true') {
    return true;
  }
  if (explicit === 'false') {
    return false;
  }

  return Boolean(process.env.GCS_BUCKET_NAME);
};

const getAvatarGcsRoot = (): string =>
  (process.env.AVATARS_GCS_ROOT || 'avatars').replace(/^\/+|\/+$/g, '');

const isSafeAvatarPath = (path: string): boolean =>
  AVATAR_PATH_PATTERN.test(path) && !path.includes('..') && !path.includes('\\');

const getPublicGcsUrl = (bucketPath: string): string | null => {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) {
    return null;
  }

  return `https://storage.googleapis.com/${bucketName}/${bucketPath}`;
};

router.get('/*', async (req, res, next) => {
  try {
    const avatarPath = req.path.replace(/^\/+/, '');

    if (!isSafeAvatarPath(avatarPath)) {
      return res.status(404).json({ error: 'Avatar not found' });
    }

    if (isLearningOsStaticMediaProxyEnabled()) {
      const upstreamResponse = await fetchLearningOsStaticMedia({
        method: 'GET',
        path: `/api/avatars/${avatarPath}`,
      });

      if (upstreamResponse.status === 404) {
        return res.status(404).json({ error: 'Avatar not found' });
      }
      if (upstreamResponse.status !== 302) {
        throw new AppError('Learning OS Static Media API request failed.', 502);
      }

      const location = upstreamResponse.headers.get('location');
      if (!location || !isAllowedAvatarRedirect(location)) {
        throw new AppError('Learning OS Static Media API returned an invalid redirect.', 502);
      }

      const cacheControl = upstreamResponse.headers.get('cache-control');
      if (cacheControl) {
        res.set('Cache-Control', cacheControl);
      }

      return res.redirect(302, location);
    }

    if (!shouldSignAvatarUrls()) {
      return res.redirect(302, `/avatars/${avatarPath}`);
    }

    const bucketPath = `${getAvatarGcsRoot()}/${avatarPath}`;

    try {
      const exists = await gcsFileExists(bucketPath);
      if (!exists) {
        return res.status(404).json({ error: 'Avatar not found' });
      }

      const signed = await getSignedReadUrl({
        filePath: bucketPath,
        expiresInSeconds: parseTtlSeconds(),
        responseType: 'image/jpeg',
      });

      res.set('Cache-Control', 'private, max-age=300');
      return res.redirect(302, signed.url);
    } catch (error) {
      console.warn(`[Avatar Assets] Signed URL failed for ${avatarPath}:`, error);
      const publicUrl = getPublicGcsUrl(bucketPath);
      if (publicUrl) {
        return res.redirect(302, publicUrl);
      }
      return res.status(404).json({ error: 'Avatar not found' });
    }
  } catch (error) {
    return next(error);
  }
});

const isAllowedAvatarRedirect = (location: string): boolean => {
  if (LOCAL_AVATAR_LOCATION_PATTERN.test(location)) {
    return true;
  }

  try {
    const url = new URL(location);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'storage.googleapis.com' &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
};

export default router;
