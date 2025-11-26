import { useState } from 'react';
import { Episode, CreateEpisodeRequest, Speaker, AudioSpeed } from '../types';

import { API_URL } from '../config';

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
    variationCount: number = 3,
    dialogueLength: number = 6
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
        body: JSON.stringify({ episodeId, speakers, variationCount, dialogueLength }),
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
    speed: AudioSpeed = 'medium',
    pauseMode: boolean = false
  ): Promise<string> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/audio/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ episodeId, dialogueId, speed, pauseMode }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate audio');
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

  const generateAllSpeedsAudio = async (
    episodeId: string,
    dialogueId: string
  ): Promise<string> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/audio/generate-all-speeds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ episodeId, dialogueId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate multi-speed audio');
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

  const getEpisode = async (episodeId: string, bustCache = false): Promise<Episode> => {
    setLoading(true);
    setError(null);

    try {
      // Add cache-busting query param when needed (e.g., after audio generation)
      const url = bustCache
        ? `${API_URL}/api/episodes/${episodeId}?_t=${Date.now()}`
        : `${API_URL}/api/episodes/${episodeId}`;
      const response = await fetch(url, {
        credentials: 'include',
        ...(bustCache && { cache: 'no-store' }), // Also prevent browser caching
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

  const deleteEpisode = async (episodeId: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/episodes/${episodeId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete episode');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const pollJobStatus = async (
    jobId: string,
    onStatusChange?: (status: 'completed' | 'failed' | 'pending') => void | Promise<void>,
    endpoint: 'dialogue' | 'audio' = 'dialogue'
  ): Promise<'completed' | 'failed' | 'pending'> => {
    const checkStatus = async (): Promise<'completed' | 'failed' | 'pending'> => {
      try {
        const response = await fetch(`${API_URL}/api/${endpoint}/job/${jobId}`, {
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

    // Poll every 2 seconds until completed or failed
    let status: 'completed' | 'failed' | 'pending' = 'pending';
    while (status === 'pending') {
      status = await checkStatus();

      if (onStatusChange) {
        await onStatusChange(status);
      }

      if (status === 'pending') {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return status;
  };

  return {
    loading,
    error,
    createEpisode,
    generateDialogue,
    generateAudio,
    generateAllSpeedsAudio,
    getEpisode,
    deleteEpisode,
    pollJobStatus,
  };
}
