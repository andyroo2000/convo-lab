function errorMessageFromPayload(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  if ('error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }

  if ('message' in payload && typeof payload.message === 'string') {
    return payload.message;
  }

  if (
    'error' in payload &&
    typeof payload.error === 'object' &&
    payload.error !== null &&
    'message' in payload.error &&
    typeof payload.error.message === 'string'
  ) {
    return payload.error.message;
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
