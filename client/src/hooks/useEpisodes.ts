import { useState, useCallback } from 'react';
import { Episode, CreateEpisodeRequest, Speaker, AudioSpeed } from '../types';

import { episodeApi, readEpisodeApiError } from '../lib/episodeApi';
import { generationApi, readGenerationApiError } from '../lib/generationApi';
import { JsonRequestError } from '../lib/apiClient';
import { errorMessageFromPayload } from '../lib/apiError';
import type { GenerationRequestAcknowledgement } from '../lib/generationRequest';

interface ErrorWithMetadata {
  message: string;
  status?: number;
  cooldown?: {
    remainingSeconds: number;
    retryAfter: string;
  };
}

interface DialogueGenerationOptions {
  jlptLevel?: string;
  vocabSeedOverride?: string;
  grammarSeedOverride?: string;
  clientRequestId?: string;
  viewAsUserId?: string;
}

type GenerateDialogueArguments = [
  episodeId: string,
  speakers: Speaker[],
  variationCount?: number,
  dialogueLength?: number,
  options?: DialogueGenerationOptions,
];

type JobStatus = 'completed' | 'failed' | 'pending';
type JobEndpoint = 'dialogue' | 'audio';

interface JobStatusRequest {
  jobId: string;
  endpoint: JobEndpoint;
  signal?: AbortSignal;
}

interface JobStatusAttempt extends JobStatusRequest {
  attempt: number;
}

const MAX_POLLING_RETRIES = 3;
const POLLING_RETRY_DELAYS = [1000, 2000, 4000] as const;

function pollingDelay(delay: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Polling aborted', 'AbortError'));
      return;
    }

    let timeoutId: number | undefined;
    const onAbort = () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      reject(new DOMException('Polling aborted', 'AbortError'));
    };
    timeoutId = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, delay);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function dialogueGenerationUrl(options?: DialogueGenerationOptions): string {
  const viewAsParam = options?.viewAsUserId
    ? `?${new URLSearchParams({ viewAs: options.viewAsUserId })}`
    : '';
  return `${generationApi.dialogue.generate}${viewAsParam}`;
}

function cooldownFromPayload(payload: unknown): ErrorWithMetadata['cooldown'] | undefined {
  if (typeof payload !== 'object') return undefined;
  if (payload === null) return undefined;
  if (!('cooldown' in payload)) return undefined;
  if (typeof payload.cooldown !== 'object') return undefined;
  if (payload.cooldown === null) return undefined;
  return payload.cooldown as ErrorWithMetadata['cooldown'];
}

function dialogueErrorMetadata(
  payload: unknown,
  response: Response,
  message: string
): ErrorWithMetadata {
  const metadata: ErrorWithMetadata = { message, status: response.status };
  const cooldown = cooldownFromPayload(payload);
  if (cooldown) metadata.cooldown = cooldown;
  return metadata;
}

function shouldRetryTransientResponse(status: number, attempt: number): boolean {
  if (status < 500) return false;
  if (status >= 600) return false;
  return attempt < MAX_POLLING_RETRIES - 1;
}

function jobStatusFromPayload(payload: { state?: unknown }): JobStatus {
  if (payload.state === 'completed') return 'completed';
  if (payload.state === 'failed') return 'failed';
  return 'pending';
}

async function requestJobStatus(options: JobStatusAttempt): Promise<JobStatus | undefined> {
  const response = await fetch(generationApi[options.endpoint].job(options.jobId), {
    credentials: 'include',
    signal: options.signal,
  });
  if (!response.ok) {
    if (shouldRetryTransientResponse(response.status, options.attempt)) {
      const delay = POLLING_RETRY_DELAYS[options.attempt];
      console.warn(
        `Transient error ${response.status} polling job status, retrying in ${delay}ms...`
      );
      await pollingDelay(delay, options.signal);
      return undefined;
    }
    throw new Error('Failed to fetch job status');
  }
  return jobStatusFromPayload(await response.json());
}

async function recoverJobStatus(
  error: unknown,
  options: JobStatusAttempt
): Promise<JobStatus | undefined> {
  if (options.signal?.aborted) throw error;
  if (options.attempt < MAX_POLLING_RETRIES - 1) {
    console.warn(
      `Error polling job status (attempt ${options.attempt + 1}/${MAX_POLLING_RETRIES}):`,
      error
    );
    const delay = POLLING_RETRY_DELAYS[options.attempt];
    console.warn(`Retrying in ${delay}ms...`);
    await pollingDelay(delay, options.signal);
    return undefined;
  }
  console.error('Error polling job status after all retries:', error);
  return 'pending';
}

async function checkJobStatus(options: JobStatusRequest): Promise<JobStatus> {
  for (let attempt = 0; attempt < MAX_POLLING_RETRIES; attempt += 1) {
    const attemptOptions = { ...options, attempt };
    try {
      // eslint-disable-next-line no-await-in-loop -- Sequential retry attempts required
      const status = await requestJobStatus(attemptOptions);
      if (status) return status;
    } catch (error) {
      // eslint-disable-next-line no-await-in-loop -- Retry recovery may require backoff
      const status = await recoverJobStatus(error, attemptOptions);
      if (status) return status;
    }
  }
  return 'pending';
}

// Named export is intentional for hooks
// eslint-disable-next-line import/prefer-default-export
export function useEpisodes() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorMetadata, setErrorMetadata] = useState<ErrorWithMetadata | null>(null);

  const createEpisode = async (
    request: CreateEpisodeRequest,
    viewAsUserId?: string
  ): Promise<Episode> => {
    setLoading(true);
    setError(null);

    try {
      const viewAsParam = viewAsUserId ? `?${new URLSearchParams({ viewAs: viewAsUserId })}` : '';
      const response = await fetch(`${episodeApi.collection}${viewAsParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(request),
      });
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const message = errorMessageFromPayload(payload) ?? 'Failed to create episode';
        throw new JsonRequestError(message, response.status, payload);
      }
      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const generateDialogue = async (
    ...[
      episodeId,
      speakers,
      variationCount = 3,
      dialogueLength = 6,
      options,
    ]: GenerateDialogueArguments
  ): Promise<GenerationRequestAcknowledgement> => {
    setLoading(true);
    setError(null);
    setErrorMetadata(null);

    try {
      const response = await fetch(dialogueGenerationUrl(options), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          episodeId,
          speakers,
          variationCount,
          dialogueLength,
          jlptLevel: options?.jlptLevel,
          vocabSeedOverride: options?.vocabSeedOverride,
          grammarSeedOverride: options?.grammarSeedOverride,
          clientRequestId: options?.clientRequestId,
        }),
      });
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const message = errorMessageFromPayload(payload) ?? 'Failed to generate dialogue';
        setErrorMetadata(dialogueErrorMetadata(payload, response, message));
        throw new JsonRequestError(message, response.status, payload);
      }
      return await response.json();
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

  const pollJobStatus = useCallback(
    async (
      jobId: string,
      onStatusChange?: (status: JobStatus) => void | Promise<void>,
      endpoint: JobEndpoint = 'dialogue',
      signal?: AbortSignal
    ): Promise<JobStatus> => {
      // Poll every 2 seconds until completed or failed
      let status: JobStatus = 'pending';
      while (status === 'pending') {
        if (signal?.aborted) {
          throw new DOMException('Polling aborted', 'AbortError');
        }
        // eslint-disable-next-line no-await-in-loop -- Sequential status check required
        status = await checkJobStatus({ jobId, endpoint, signal });

        if (signal?.aborted) {
          throw new DOMException('Polling aborted', 'AbortError');
        }

        if (onStatusChange) {
          // eslint-disable-next-line no-await-in-loop -- Callback execution must complete before next poll
          await onStatusChange(status);
        }

        if (signal?.aborted) {
          throw new DOMException('Polling aborted', 'AbortError');
        }

        if (status === 'pending') {
          // eslint-disable-next-line no-await-in-loop -- Polling interval delay required
          await pollingDelay(2000, signal);
        }
      }

      return status;
    },
    []
  );

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
