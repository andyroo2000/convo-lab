export const isLearningOsCourseGenerationProxyEnabled = (): boolean =>
  process.env.LEARNING_OS_COURSE_GENERATION_PROXY_ENABLED?.trim().toLowerCase() === 'true';
