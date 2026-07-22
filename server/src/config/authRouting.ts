export const isLearningOsAuthProxyEnabled = (): boolean =>
  process.env.LEARNING_OS_AUTH_PROXY_ENABLED?.trim().toLowerCase() === 'true';

export const isLearningOsProfileProxyEnabled = (): boolean =>
  process.env.LEARNING_OS_PROFILE_PROXY_ENABLED?.trim().toLowerCase() === 'true';

export const isLearningOsSignupProxyEnabled = (): boolean =>
  process.env.LEARNING_OS_SIGNUP_PROXY_ENABLED?.trim().toLowerCase() === 'true';

export const isLearningOsVerificationProxyEnabled = (): boolean =>
  process.env.LEARNING_OS_VERIFICATION_PROXY_ENABLED?.trim().toLowerCase() === 'true';

export const isLearningOsPasswordResetProxyEnabled = (): boolean =>
  process.env.LEARNING_OS_PASSWORD_RESET_PROXY_ENABLED?.trim().toLowerCase() === 'true';

export const isLearningOsPasswordResetCompletionEnabled = (): boolean =>
  process.env.LEARNING_OS_PASSWORD_RESET_COMPLETION_ENABLED?.trim().toLowerCase() === 'true';
