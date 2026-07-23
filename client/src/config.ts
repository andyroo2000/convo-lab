// API URL configuration
// In production (when served from same origin), use relative URLs
// In development, use localhost
export const API_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

export const LEARNING_OS_DIRECT_ACCOUNT_API_ENABLED =
  typeof window !== 'undefined' &&
  window.__CONVOLAB_RUNTIME_CONFIG__?.learningOsDirectAccountApi === true;

// Temporary kill-switch for onboarding welcome surfaces while content is being redesigned.
export const SHOW_ONBOARDING_WELCOME = false;
