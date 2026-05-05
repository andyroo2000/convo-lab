import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { useTranslation } from 'react-i18next';

import useWarmAudioCache from '../../hooks/useWarmAudioCache';
import { getAudioPreloadMode } from '../../lib/audioCache';
import { getAudioMimeType } from './studyCardUtils';

export interface AudioPlayerHandle {
  play: () => Promise<boolean>;
  stop: () => void;
}

interface StudyAudioPlayerProps {
  filename?: string | null;
  label: string;
  size?: 'default' | 'compact';
  showTimeline?: boolean;
  timelineMode?: 'always' | 'desktop';
  testId?: string;
  url: string;
}

const isInterruptedPlayError = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError';

const StudyAudioPlayer = forwardRef<AudioPlayerHandle, StudyAudioPlayerProps>(
  (
    {
      filename,
      label,
      size = 'default',
      showTimeline = false,
      timelineMode = 'always',
      testId,
      url,
    },
    ref
  ) => {
    const { t } = useTranslation('study');
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const playAttemptRef = useRef(0);
    const [playing, setPlaying] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useWarmAudioCache([url]);

    const setPlayingState = useCallback((nextPlaying: boolean) => {
      setPlaying(nextPlaying);
    }, []);

    const stop = useCallback(() => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
      setPlayingState(false);
    }, [setPlayingState]);

    const play = useCallback(async () => {
      const audio = audioRef.current;
      if (!audio) return false;
      const playAttempt = playAttemptRef.current + 1;
      playAttemptRef.current = playAttempt;

      try {
        setErrorMessage(null);
        audio.pause();
        audio.currentTime = 0;
        // Autoplay and manual replay intentionally share the same error surface because
        // browsers like iOS Safari may reject play() until media is user-gesture eligible.
        await audio.play();
        if (playAttemptRef.current !== playAttempt) return false;
        setPlayingState(true);
        return true;
      } catch (error) {
        if (playAttemptRef.current !== playAttempt) return false;

        if (isInterruptedPlayError(error)) {
          setPlayingState(false);
          return false;
        }

        console.error(`Unable to play ${label}:`, error);
        setPlayingState(false);
        setErrorMessage(t('preview.audioFailed'));
        return false;
      }
    }, [label, setPlayingState, t]);

    useImperativeHandle(
      ref,
      () => ({
        play,
        stop,
      }),
      [play, stop]
    );

    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return undefined;

      const handleEnded = () => setPlayingState(false);
      const handlePause = () => setPlayingState(false);
      const handlePlay = () => {
        setPlayingState(true);
        setErrorMessage(null);
      };
      const handleCanPlay = () => setErrorMessage(null);
      const handleError = () => {
        setPlayingState(false);
        setErrorMessage(t('preview.audioFailed'));
      };

      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('pause', handlePause);
      audio.addEventListener('play', handlePlay);
      audio.addEventListener('canplay', handleCanPlay);
      audio.addEventListener('error', handleError);

      return () => {
        audio.pause();
        audio.currentTime = 0;
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('pause', handlePause);
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('canplay', handleCanPlay);
        audio.removeEventListener('error', handleError);
      };
    }, [setPlayingState, t, url]);

    useEffect(() => {
      setErrorMessage(null);
    }, [url]);

    const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      play().catch(() => {});
    };

    const showButton = !showTimeline || timelineMode === 'desktop';
    const buttonClasses =
      timelineMode === 'desktop' ? 'flex justify-center md:hidden' : 'flex justify-center';
    const timelineClasses =
      timelineMode === 'desktop'
        ? 'mx-auto hidden w-full max-w-xl md:block'
        : 'mx-auto w-full max-w-xl';
    const buttonSizeClasses =
      size === 'compact'
        ? 'h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12'
        : 'h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20';
    const iconSizeClasses = size === 'compact' ? 'h-5 w-5' : 'h-6 w-6 sm:h-7 sm:w-7 md:h-9 md:w-9';
    const audioPreload = getAudioPreloadMode(url);

    return (
      <div className={size === 'compact' ? 'space-y-2' : 'space-y-3'} data-testid={testId}>
        {showButton ? (
          <div className={buttonClasses}>
            <button
              type="button"
              onClick={handleClick}
              onKeyDown={(event) => {
                event.stopPropagation();
              }}
              aria-label={label}
              data-testid={testId ? `${testId}-button` : undefined}
              className={`inline-flex items-center justify-center rounded-full border border-gray-400 bg-white text-navy shadow-sm transition hover:border-navy hover:shadow-md ${
                playing ? 'ring-2 ring-navy/20' : ''
              } ${buttonSizeClasses}`}
            >
              <svg
                viewBox="0 0 24 24"
                className={`ml-0.5 fill-current ${iconSizeClasses}`}
                aria-hidden="true"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
        ) : null}

        <audio
          key={url}
          ref={audioRef}
          preload={audioPreload}
          controls={showTimeline}
          aria-label={label}
          data-testid={testId ? `${testId}-element` : undefined}
          className={showTimeline ? timelineClasses : 'hidden'}
        >
          <source
            src={url}
            type={getAudioMimeType(url, filename)}
            data-testid={testId ? `${testId}-source` : undefined}
          />
        </audio>
        {errorMessage ? (
          <p
            className="text-center text-sm text-red-600"
            data-testid={testId ? `${testId}-error` : undefined}
          >
            {errorMessage}
          </p>
        ) : null}
      </div>
    );
  }
);

StudyAudioPlayer.displayName = 'StudyAudioPlayer';

export default StudyAudioPlayer;
