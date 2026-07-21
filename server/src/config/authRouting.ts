export const isLearningOsAuthProxyEnabled = (): boolean =>
  process.env.LEARNING_OS_AUTH_PROXY_ENABLED?.trim().toLowerCase() === 'true';
