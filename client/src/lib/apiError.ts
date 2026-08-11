function nonBlankString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  return value.trim() || null;
}

function errorMessageFromPayload(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  if ('error' in payload) {
    const error = nonBlankString(payload.error);
    if (error) return error;
  }

  if ('message' in payload) {
    const message = nonBlankString(payload.message);
    if (message) return message;
  }

  if (
    'error' in payload &&
    typeof payload.error === 'object' &&
    payload.error !== null &&
    'message' in payload.error
  ) {
    return nonBlankString(payload.error.message);
  }

  return null;
}

export default async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    return errorMessageFromPayload(await response.json()) ?? fallback;
  } catch {
    return fallback;
  }
}
