// API URL configuration
// In production (when served from same origin), use relative URLs
// In development, use localhost
export const API_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');
