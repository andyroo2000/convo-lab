import { useState, useCallback } from 'react';
import { Episode, AudioSpeed } from '../types';

import { episodeApi, readEpisodeApiError } from '../lib/episodeApi';
import { generationApi, readGenerationApiError } from '../lib/generationApi';

// Named export is intentional for hooks
// eslint-disable-next-line import/prefer-default-export
export function useEpisodes() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateAudio = async (
    episodeId: string,
    dialogueId: string,
    speed: AudioSpeed = 'medium',
    pauseMode: boolean = false
  ): Promise<string> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(generationApi.audio.generate, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ episodeId, dialogueId, speed, pauseMode }),
      });

      if (!response.ok) {
        throw new Error(await readGenerationApiError(response, 'Failed to generate audio'));
      }

      const data = await response.json();
      return data.jobId;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const generateAllSpeedsAudio = useCallback(
    async (episodeId: string, dialogueId: string, signal?: AbortSignal): Promise<string> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(generationApi.audio.generateAllSpeeds, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          signal,
          body: JSON.stringify({ episodeId, dialogueId }),
        });

        if (!response.ok) {
          throw new Error(
            await readGenerationApiError(response, 'Failed to generate multi-speed audio')
          );
        }

        const data = await response.json();
        return data.jobId;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

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
        // Build query parameters
        const params = new URLSearchParams();
        if (bustCache) params.append('_t', Date.now().toString());
        if (viewAsUserId) params.append('viewAs', viewAsUserId);

        const queryString = params.toString();
        const url = `${episodeApi.member(episodeId)}${queryString ? `?${queryString}` : ''}`;

        const response = await fetch(url, {
          credentials: 'include',
          signal,
          ...(bustCache && { cache: 'no-store' }), // Also prevent browser caching
        });

        if (!response.ok) {
          throw new Error(await readEpisodeApiError(response, 'Failed to fetch episode'));
        }

        const episode = await response.json();
        return episode;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
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

      if (!response.ok) {
        throw new Error(await readEpisodeApiError(response, 'Failed to delete episode'));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    generateAudio,
    generateAllSpeedsAudio,
    getEpisode,
    deleteEpisode,
  };
}
