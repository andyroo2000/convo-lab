export const isLearningOsImageGenerationProxyEnabled = (): boolean =>
  process.env.LEARNING_OS_IMAGE_GENERATION_PROXY_ENABLED?.trim().toLowerCase() === 'true';
