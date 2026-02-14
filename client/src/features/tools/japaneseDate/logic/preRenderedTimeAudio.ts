export type TimeHourFormat = '12h' | '24h';

type TimeAudioSegmentArgs = {
  hour24: number;
  minute: number;
  hourFormat: TimeHourFormat;
};

export type AudioSequencePlayback = {
  stop: () => void;
  finished: Promise<void>;
};

const TIME_AUDIO_BASE_URL = '/tools-audio/japanese-time/google-kento-professional';

const toTwoDigits = (value: number) => String(value).padStart(2, '0');

function assertRange(name: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
}

function playSingleClip(url: string, abortSignal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.preload = 'auto';

    let handleAbort: () => void = () => {};
    let handleEnded: () => void = () => {};
    let handleError: () => void = () => {};

    const cleanup = () => {
      abortSignal.removeEventListener('abort', handleAbort);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
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

export function buildTimeAudioClipUrls(args: TimeAudioSegmentArgs): string[] {
  const { hour24, minute, hourFormat } = args;
  assertRange('hour24', hour24, 0, 23);
  assertRange('minute', minute, 0, 59);

  const minutePath = `${TIME_AUDIO_BASE_URL}/time/minute/${toTwoDigits(minute)}.mp3`;
  const hourPath =
    hourFormat === '12h'
      ? `${TIME_AUDIO_BASE_URL}/time/12h/part1/${hour24 < 12 ? 'gozen' : 'gogo'}-${toTwoDigits(hour24 % 12 || 12)}.mp3`
      : `${TIME_AUDIO_BASE_URL}/time/24h/part1/${toTwoDigits(hour24)}.mp3`;

  return [hourPath, minutePath];
}

export function playAudioClipSequence(urls: string[]): AudioSequencePlayback {
  const abortController = new AbortController();

  const finished = urls.reduce<Promise<void>>(
    (sequence, url) =>
      sequence.then(() => {
        if (abortController.signal.aborted) {
          throw new DOMException('Playback aborted', 'AbortError');
        }
        return playSingleClip(url, abortController.signal);
      }),
    Promise.resolve()
  );

  return {
    stop: () => {
      abortController.abort();
    },
    finished,
  };
}
