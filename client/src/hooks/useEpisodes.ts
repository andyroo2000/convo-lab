import { useState } from 'react';
import { Episode, CreateEpisodeRequest, Speaker } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function useEpisodes() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createEpisode = async (request: CreateEpisodeRequest): Promise<Episode> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/episodes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create episode');
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
  };

  const generateDialogue = async (
    episodeId: string,
    speakers: Speaker[],
    variationCount: number = 3
  ): Promise<{ jobId: string }> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/dialogue/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ episodeId, speakers, variationCount }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate dialogue');
      }

      const data = await response.json();
      return { jobId: data.jobId };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const generateAudio = async (
    episodeId: string,
    dialogueId: string,
    speed: 'normal' | 'slow' = 'normal',
    pauseMode: boolean = false
  ): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/episodes/${episodeId}/audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ dialogueId, speed, pauseMode }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate audio');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getEpisode = async (episodeId: string): Promise<Episode> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/episodes/${episodeId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch episode');
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
  };

  const pollJobStatus = async (jobId: string): Promise<'completed' | 'failed' | 'pending'> => {
    try {
      const response = await fetch(`${API_URL}/api/dialogue/job/${jobId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch job status');
      }

      const data = await response.json();
      return data.state === 'completed' ? 'completed' : data.state === 'failed' ? 'failed' : 'pending';
    } catch (err) {
      console.error('Error polling job status:', err);
      return 'pending';
    }
  };

  return {
    loading,
    error,
    createEpisode,
    generateDialogue,
    generateAudio,
    getEpisode,
    pollJobStatus,
  };
}
