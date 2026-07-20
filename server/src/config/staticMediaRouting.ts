const AVATAR_PATH_PATTERN = /^(?:voices\/)?[a-z]{2}-[a-z0-9-]+\.jpg(?![\s\S])/;

export const isLearningOsStaticMediaProxyEnabled = (): boolean =>
  process.env.LEARNING_OS_STATIC_MEDIA_PROXY_ENABLED?.trim().toLowerCase() === 'true';

export const isStaticMediaAvatarPath = (path: string): boolean =>
  AVATAR_PATH_PATTERN.test(path) && !path.includes('..') && !path.includes('\\');
