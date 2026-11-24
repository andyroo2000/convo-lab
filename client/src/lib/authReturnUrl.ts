export const DEFAULT_AUTH_DESTINATION = '/app/journal';

// Only private application paths are login destinations. Reject schemes,
// authority URLs, backslashes, dot segments, and encoded path separators.
const PRIVATE_PATH = /^\/app(?:\/[A-Za-z0-9_-]+)*\/?(?:[?#][^\s\\\p{Cc}]*)?$/u;

export function safeAuthReturnUrl(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_AUTH_DESTINATION;
  if (value.length > 2048) return DEFAULT_AUTH_DESTINATION;
  if (value.trim() !== value) return DEFAULT_AUTH_DESTINATION;
  return PRIVATE_PATH.test(value) ? value : DEFAULT_AUTH_DESTINATION;
}
