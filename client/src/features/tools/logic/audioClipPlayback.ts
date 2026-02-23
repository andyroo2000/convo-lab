import { resolveToolAudioPlaybackUrls } from './toolAudioUrlResolver';

export type AudioSequencePlayback = {
  stop: () => void;
  finished: Promise<void>;
  setVolume: (volume: number) => void;
};

type PlaybackOptions = {
  volume?: number;
  resolveToolAudioUrls?: boolean;
  clipTrimEndMs?: number;
};

function playSingleClip(
  url: string,
  abortSignal: AbortSignal,
  trimEndMs: number,
  getVolume: () => number,
  setActiveAudio: (audio: HTMLAudioElement | null) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.volume = getVolume();
    setActiveAudio(audio);

    let handleAbort: () => void = () => {};
    let handleEnded: () => void = () => {};
    let handleError: () => void = () => {};
    let handleLoadedMetadata: () => void = () => {};
    let trimTimeoutId: number | null = null;

    const cleanup = () => {
      abortSignal.removeEventListener('abort', handleAbort);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      if (trimTimeoutId !== null) {
        window.clearTimeout(trimTimeoutId);
      }
      setActiveAudio(null);
    };

    handleEnded = () => {
      cleanup();
      resolve();
    };

    handleError = () => {
      cleanup();
      reject(new Error(`Failed to play clip: ${url}`));
    };

    handleAbort = () => {
      cleanup();
      audio.pause();
      audio.currentTime = 0;
      reject(new DOMException('Playback aborted', 'AbortError'));
    };

    abortSignal.addEventListener('abort', handleAbort);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    if (trimEndMs > 0) {
      handleLoadedMetadata = () => {
        if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
          return;
        }

        const trimDelayMs = Math.max(0, audio.duration * 1000 - trimEndMs);
        trimTimeoutId = window.setTimeout(() => {
          cleanup();
          audio.pause();
          audio.currentTime = 0;
          resolve();
        }, trimDelayMs);
      };

      if (audio.readyState >= 1) {
        handleLoadedMetadata();
      } else {
        audio.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
      }
    }

    audio.play().catch((error) => {
      cleanup();
      reject(error);
    });
  });
}

export function playAudioClipSequence(
  urls: string[],
  options: PlaybackOptions = {}
): AudioSequencePlayback {
  const abortController = new AbortController();
  let volume = Math.max(0, Math.min(1, options.volume ?? 1));
  let activeAudio: HTMLAudioElement | null = null;
  const shouldResolveToolAudioUrls = options.resolveToolAudioUrls ?? true;
  const clipTrimEndMs = Math.max(0, options.clipTrimEndMs ?? 0);

  const playResolvedSequence = (resolvedUrls: string[]): Promise<void> => {
    if (resolvedUrls.length === 0) {
      return Promise.resolve();
    }

    return resolvedUrls.slice(1).reduce<Promise<void>>(
      (sequence, url, index) =>
        sequence.then(() => {
          if (abortController.signal.aborted) {
            throw new DOMException('Playback aborted', 'AbortError');
          }

          return playSingleClip(
            url,
            abortController.signal,
            // `index` is in `resolvedUrls.slice(1)`, so the last playable clip in this reduce chain
            // is at `resolvedUrls.length - 2` (the overall final clip should not be trimmed).
            index < resolvedUrls.length - 2 ? clipTrimEndMs : 0,
            () => volume,
            (audio) => {
              activeAudio = audio;
            }
          );
        }),
      playSingleClip(
        resolvedUrls[0],
        abortController.signal,
        resolvedUrls.length > 1 ? clipTrimEndMs : 0,
        () => volume,
        (audio) => {
          activeAudio = audio;
        }
      )
    );
  };

  const finished = shouldResolveToolAudioUrls
    ? resolveToolAudioPlaybackUrls(urls)
        .catch(() => urls)
        .then(playResolvedSequence)
    : playResolvedSequence(urls);

  return {
    stop: () => {
      abortController.abort();
    },
    finished,
    setVolume: (nextVolume) => {
      volume = Math.max(0, Math.min(1, nextVolume));
      if (activeAudio) {
        activeAudio.volume = volume;
      }
    },
  };
}
