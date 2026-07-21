export const isLearningOsAuthProxyEnabled = (): boolean =>
  process.env.LEARNING_OS_AUTH_PROXY_ENABLED?.trim().toLowerCase() === 'true';

export const isLearningOsSignupProxyEnabled = (): boolean =>
  process.env.LEARNING_OS_SIGNUP_PROXY_ENABLED?.trim().toLowerCase() === 'true';

export const isLearningOsVerificationProxyEnabled = (): boolean =>
  process.env.LEARNING_OS_VERIFICATION_PROXY_ENABLED?.trim().toLowerCase() === 'true';
