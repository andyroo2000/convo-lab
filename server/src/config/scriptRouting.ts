export const isLearningOsScriptProxyEnabled = (): boolean =>
  process.env.LEARNING_OS_SCRIPT_PROXY_ENABLED?.trim().toLowerCase() === 'true';
