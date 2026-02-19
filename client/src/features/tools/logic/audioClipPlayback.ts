import { resolveToolAudioPlaybackUrls } from './toolAudioUrlResolver';

export type AudioSequencePlayback = {
  stop: () => void;
  finished: Promise<void>;
  setVolume: (volume: number) => void;
};

type PlaybackOptions = {
  volume?: number;
};

function playSingleClip(
  url: string,
  abortSignal: AbortSignal,
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

    const cleanup = () => {
      abortSignal.removeEventListener('abort', handleAbort);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
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

  const finished = resolveToolAudioPlaybackUrls(urls)
    .catch(() => urls)
    .then((resolvedUrls) =>
      resolvedUrls.reduce<Promise<void>>(
        (sequence, url) =>
          sequence.then(() => {
            if (abortController.signal.aborted) {
              throw new DOMException('Playback aborted', 'AbortError');
            }
            return playSingleClip(
              url,
              abortController.signal,
              () => volume,
              (audio) => {
                activeAudio = audio;
              }
            );
          }),
        Promise.resolve()
      )
    );

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
