export const isLearningOsAudioGenerationProxyEnabled = (): boolean =>
  process.env.LEARNING_OS_AUDIO_GENERATION_PROXY_ENABLED?.trim().toLowerCase() === 'true';
