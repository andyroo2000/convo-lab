// Relative URLs use the production router or the local Vite Learning OS proxy.
export const API_URL = import.meta.env.VITE_API_URL || '';

// Temporary kill-switch for onboarding welcome surfaces while content is being redesigned.
export const SHOW_ONBOARDING_WELCOME = false;
