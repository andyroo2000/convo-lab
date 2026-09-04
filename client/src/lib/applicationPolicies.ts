const CHUNK_LOAD_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|Loading chunk.*failed|ChunkLoadError/i;

export function isChunkLoadingError(event: ErrorEvent): boolean {
  if (CHUNK_LOAD_ERROR_PATTERN.test(event.message)) return true;
  if (!event.error) return false;
  return CHUNK_LOAD_ERROR_PATTERN.test(event.error.message);
}

function getHttpStatus(error: unknown): number | null {
  if (typeof error !== 'object') return null;
  if (error === null) return null;
  if (!('response' in error)) return null;
  if (typeof error.response !== 'object') return null;
  if (error.response === null) return null;
  if (!('status' in error.response)) return null;
  if (typeof error.response.status !== 'number') return null;
  return error.response.status;
}

function isClientError(error: unknown): boolean {
  const status = getHttpStatus(error);
  if (status === null) return false;
  if (status < 400) return false;
  return status < 500;
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (isClientError(error)) return false;
  return failureCount < 2;
}
