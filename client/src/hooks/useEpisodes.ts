import { useState, useCallback } from 'react';
import { Episode } from '../types';

import { episodeApi, readEpisodeApiError } from '../lib/episodeApi';

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Unknown error');

const cacheMode = (bustCache: boolean): RequestCache => (bustCache ? 'no-store' : 'default');

async function requireSuccess(response: Response, fallback: string): Promise<void> {
  if (!response.ok) throw new Error(await readEpisodeApiError(response, fallback));
}

function episodeUrl(episodeId: string, bustCache: boolean, viewAsUserId?: string): string {
  const params = new URLSearchParams();
  if (bustCache) params.append('_t', Date.now().toString());
  if (viewAsUserId) params.append('viewAs', viewAsUserId);
  const query = params.toString();
  return `${episodeApi.member(episodeId)}${query ? `?${query}` : ''}`;
}

// Named export is intentional for hooks
// eslint-disable-next-line import/prefer-default-export
export function useEpisodes() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getEpisode = useCallback(
    async (
      episodeId: string,
      bustCache = false,
      viewAsUserId?: string,
      signal?: AbortSignal
    ): Promise<Episode> => {
      setLoading(true);
      setError(null);

      try {
        const url = episodeUrl(episodeId, bustCache, viewAsUserId);

        const response = await fetch(url, {
          credentials: 'include',
          signal,
          cache: cacheMode(bustCache),
        });

        await requireSuccess(response, 'Failed to fetch episode');

        const episode = await response.json();
        return episode;
      } catch (err) {
        setError(errorMessage(err));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteEpisode = async (episodeId: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(episodeApi.member(episodeId), {
        method: 'DELETE',
        credentials: 'include',
      });

      await requireSuccess(response, 'Failed to delete episode');
    } catch (err) {
      setError(errorMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    getEpisode,
    deleteEpisode,
  };
}
