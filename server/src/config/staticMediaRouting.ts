const AVATAR_PATH_PATTERN = /^(?:voices\/)?[a-z]{2}-[a-z0-9-]+\.jpg(?![\s\S])/;

export const isLearningOsStaticMediaProxyEnabled = (): boolean =>
  process.env.LEARNING_OS_STATIC_MEDIA_PROXY_ENABLED?.trim().toLowerCase() === 'true';

export const isStaticMediaAvatarPath = (path: string): boolean =>
  AVATAR_PATH_PATTERN.test(path) && !path.includes('..') && !path.includes('\\');

export const getExpectedStaticMediaGcsPath = (objectPath: string): string | null => {
  const bucket = process.env.GCS_BUCKET_NAME?.trim();
  const segments = bucket ? [bucket, ...objectPath.split('/')] : [];

  if (
    segments.length < 2 ||
    segments.some(
      (segment) =>
        !segment || segment === '.' || segment === '..' || /[\\\p{Cc}\p{Cf}]/u.test(segment)
    )
  ) {
    return null;
  }

  return `/${segments.map((segment) => encodeURIComponent(segment)).join('/')}`;
};
