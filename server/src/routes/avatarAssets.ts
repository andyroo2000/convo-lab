import { Router } from 'express';

import { gcsFileExists, getSignedReadUrl } from '../services/storageClient.js';

const router = Router();

const AVATAR_PATH_PATTERN = /^(?:voices\/)?[a-z]{2}-[a-z0-9-]+\.jpg$/;
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

router.get('/*', async (req, res) => {
  const avatarPath = req.path.replace(/^\/+/, '');

  if (!isSafeAvatarPath(avatarPath)) {
    return res.status(404).json({ error: 'Avatar not found' });
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
});

export default router;
