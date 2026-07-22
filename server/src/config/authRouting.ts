export const isLearningOsAuthProxyEnabled = (): boolean =>
  process.env.LEARNING_OS_AUTH_PROXY_ENABLED?.trim().toLowerCase() === 'true';

export const isLearningOsProfileProxyEnabled = (): boolean =>
  process.env.LEARNING_OS_PROFILE_PROXY_ENABLED?.trim().toLowerCase() === 'true';
