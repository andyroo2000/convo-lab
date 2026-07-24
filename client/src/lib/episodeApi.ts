import readApiError from './apiError';

export interface EpisodeApiContract {
  collection: string;
  member: (episodeId: string) => string;
}

export function createEpisodeApiContract(apiUrl = ''): EpisodeApiContract {
  const collection = `${apiUrl}/api/convolab/episodes`;

  return {
    collection,
    member: (episodeId) => `${collection}/${encodeURIComponent(episodeId)}`,
  };
}

export const readEpisodeApiError = readApiError;
export const episodeApi = createEpisodeApiContract();
