import { API_URL, LEARNING_OS_DIRECT_EPISODE_API_ENABLED } from '../config';

export interface EpisodeApiContract {
  collection: string;
  member: (episodeId: string) => string;
}

export function createEpisodeApiContract(
  directLearningOs: boolean,
  apiUrl: string = API_URL
): EpisodeApiContract {
  const collection = `${apiUrl}${directLearningOs ? '/api/convolab/episodes' : '/api/episodes'}`;

  return {
    collection,
    member: (episodeId) => `${collection}/${encodeURIComponent(episodeId)}`,
  };
}

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

export async function readEpisodeApiError(response: Response, fallback: string): Promise<string> {
  try {
    return errorMessageFromPayload(await response.json()) ?? fallback;
  } catch {
    return fallback;
  }
}

export const episodeApi = createEpisodeApiContract(LEARNING_OS_DIRECT_EPISODE_API_ENABLED);
