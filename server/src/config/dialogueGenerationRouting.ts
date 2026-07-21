export const isLearningOsDialogueGenerationProxyEnabled = (): boolean =>
  process.env.LEARNING_OS_DIALOGUE_GENERATION_PROXY_ENABLED?.trim().toLowerCase() === 'true';
