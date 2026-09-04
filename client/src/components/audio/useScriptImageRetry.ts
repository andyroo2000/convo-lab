import { useEffect, useRef, useState } from 'react';

import type { AudioScript } from '../../types';
import { readScriptApiError, scriptApi } from '../../lib/scriptApi';

const RETRY_TIMEOUT_MS = 5 * 60 * 1000;
const RETRY_POLL_INTERVAL_MS = 2500;

function imageGenerationFinished(script: AudioScript) {
  return ['ready', 'partial', 'error'].includes(script.imageStatus ?? '');
}

function waitForNextPoll() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, RETRY_POLL_INTERVAL_MS);
  });
}

async function requestImageRetry(episodeId: string) {
  const response = await fetch(scriptApi.operation(episodeId, 'images'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ force: false }),
  });
  if (!response.ok) {
    throw new Error(await readScriptApiError(response, 'Failed to retry images.'));
  }
}

async function fetchImageStatus(episodeId: string) {
  const response = await fetch(scriptApi.operation(episodeId, 'status'), {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(await readScriptApiError(response, 'Failed to check image status.'));
  }
  return (await response.json()) as AudioScript;
}

async function pollImageStatus(
  episodeId: string,
  isMounted: () => boolean,
  onStatus: (script: AudioScript) => void
) {
  const startedAt = Date.now();

  /* eslint-disable no-await-in-loop -- polling must wait between status requests */
  while (Date.now() - startedAt < RETRY_TIMEOUT_MS) {
    const nextScript = await fetchImageStatus(episodeId);
    if (!isMounted()) return;
    onStatus(nextScript);
    if (imageGenerationFinished(nextScript)) return;
    await waitForNextPoll();
  }
  /* eslint-enable no-await-in-loop */

  throw new Error('Image retry timed out. Please try again later.');
}

export default function useScriptImageRetry(episodeId: string) {
  const [scriptOverride, setScriptOverride] = useState<AudioScript | null>(null);
  const [isRetryingImages, setIsRetryingImages] = useState(false);
  const [imageRetryError, setImageRetryError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    setScriptOverride(null);
    setImageRetryError(null);
    setIsRetryingImages(false);
  }, [episodeId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const retryImages = async () => {
    setImageRetryError(null);
    setIsRetryingImages(true);

    try {
      await requestImageRetry(episodeId);
      if (!mountedRef.current) return;
      await pollImageStatus(episodeId, () => mountedRef.current, setScriptOverride);
    } catch (error) {
      if (mountedRef.current) {
        setImageRetryError(error instanceof Error ? error.message : 'Failed to retry images.');
      }
    } finally {
      if (mountedRef.current) {
        setIsRetryingImages(false);
      }
    }
  };

  return { imageRetryError, isRetryingImages, retryImages, scriptOverride };
}
