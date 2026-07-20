export const isLearningOsStaticMediaProxyEnabled = (): boolean =>
  process.env.LEARNING_OS_STATIC_MEDIA_PROXY_ENABLED?.trim().toLowerCase() === 'true';
