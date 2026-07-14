// API URL configuration
// In production (when served from same origin), use relative URLs
// In development, use localhost
export const API_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

export const LEARNING_OS_API_URL = import.meta.env.VITE_LEARNING_OS_API_URL || '';
export const LEARNING_OS_API_TOKEN = import.meta.env.VITE_LEARNING_OS_API_TOKEN || '';

// Temporary kill-switch for onboarding welcome surfaces while content is being redesigned.
export const SHOW_ONBOARDING_WELCOME = false;
