import { API_URL, LEARNING_OS_DIRECT_EPISODE_API_ENABLED } from '../config';
import readApiError from './apiError';

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

export const readEpisodeApiError = readApiError;
export const episodeApi = createEpisodeApiContract(LEARNING_OS_DIRECT_EPISODE_API_ENABLED);
