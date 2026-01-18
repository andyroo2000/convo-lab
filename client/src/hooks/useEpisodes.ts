import { useState } from 'react';
import { Episode, CreateEpisodeRequest, Speaker, AudioSpeed } from '../types';

import { API_URL } from '../config';

interface QuotaInfo {
  limit: number;
  used: number;
  remaining: number;
  resetsAt: string;
}

interface ErrorWithMetadata {
  message: string;
  status?: number;
  quota?: QuotaInfo;
  cooldown?: {
    remainingSeconds: number;
    retryAfter: string;
  };
}

// Named export is intentional for hooks
// eslint-disable-next-line import/prefer-default-export
export function useEpisodes() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorMetadata, setErrorMetadata] = useState<ErrorWithMetadata | null>(null);

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
    setErrorMetadata(null);

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
        const errorMessage = errorData.error || errorData.message || 'Failed to generate dialogue';

        // Capture metadata for quota/cooldown errors
        const metadata: ErrorWithMetadata = {
          message: errorMessage,
          status: response.status,
        };

        if (errorData.quota) {
          metadata.quota = errorData.quota;
        }

        if (errorData.cooldown) {
          metadata.cooldown = errorData.cooldown;
        }

        setErrorMetadata(metadata);
        throw new Error(errorMessage);
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

  const generateAllSpeedsAudio = async (episodeId: string, dialogueId: string): Promise<string> => {
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

  const getEpisode = async (
    episodeId: string,
    bustCache = false,
    viewAsUserId?: string
  ): Promise<Episode> => {
    setLoading(true);
    setError(null);

    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (bustCache) params.append('_t', Date.now().toString());
      if (viewAsUserId) params.append('viewAs', viewAsUserId);

      const queryString = params.toString();
      const url = `${API_URL}/api/episodes/${episodeId}${queryString ? `?${queryString}` : ''}`;

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
      const MAX_RETRIES = 3;
      const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

      for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
        try {
          // eslint-disable-next-line no-await-in-loop -- Sequential retry attempts required
          const response = await fetch(`${API_URL}/api/${endpoint}/job/${jobId}`, {
            credentials: 'include',
          });

          if (!response.ok) {
            // Check if it's a transient error (500, 502, 503, 504)
            if (response.status >= 500 && response.status < 600 && attempt < MAX_RETRIES - 1) {
              console.warn(
                `Transient error ${response.status} polling job status, retrying in ${RETRY_DELAYS[attempt]}ms...`
              );
              // eslint-disable-next-line no-await-in-loop -- Delay needed for retry backoff
              await new Promise((resolve) => {
                setTimeout(resolve, RETRY_DELAYS[attempt]);
              });
              // eslint-disable-next-line no-continue -- Continue needed to retry on transient errors
              continue; // Retry
            }
            throw new Error('Failed to fetch job status');
          }

          // eslint-disable-next-line no-await-in-loop -- Sequential parsing of response required
          const data = await response.json();
          if (data.state === 'completed') return 'completed';
          if (data.state === 'failed') return 'failed';
          return 'pending';
        } catch (err) {
          // Network errors or other failures
          if (attempt < MAX_RETRIES - 1) {
            console.warn(`Error polling job status (attempt ${attempt + 1}/${MAX_RETRIES}):`, err);
            console.warn(`Retrying in ${RETRY_DELAYS[attempt]}ms...`);
            // eslint-disable-next-line no-await-in-loop -- Delay needed for retry backoff
            await new Promise((resolve) => {
              setTimeout(resolve, RETRY_DELAYS[attempt]);
            });
            // eslint-disable-next-line no-continue -- Continue needed to retry on network errors
            continue; // Retry
          }
          // Final attempt failed
          console.error('Error polling job status after all retries:', err);
          return 'pending';
        }
      }

      // Should never reach here, but return pending as fallback
      return 'pending';
    };

    // Poll every 2 seconds until completed or failed
    let status: 'completed' | 'failed' | 'pending' = 'pending';
    while (status === 'pending') {
      // eslint-disable-next-line no-await-in-loop -- Sequential status check required
      status = await checkStatus();

      if (onStatusChange) {
        // eslint-disable-next-line no-await-in-loop -- Callback execution must complete before next poll
        await onStatusChange(status);
      }

      if (status === 'pending') {
        // eslint-disable-next-line no-await-in-loop -- Polling interval delay required
        await new Promise((resolve) => {
          setTimeout(resolve, 2000);
        });
      }
    }

    return status;
  };

  return {
    loading,
    error,
    errorMetadata,
    createEpisode,
    generateDialogue,
    generateAudio,
    generateAllSpeedsAudio,
    getEpisode,
    deleteEpisode,
    pollJobStatus,
  };
}
