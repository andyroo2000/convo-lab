import {
  forwardRef,
  useContext,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { Volume2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { StudyReplayHost } from './studyReplayContext';

import useWarmAudioCache from '../../hooks/useWarmAudioCache';
import { getAudioPreloadMode } from '../../lib/audioCache';
import { getAudioMimeType } from './studyCardUtils';
import StudySpeakerIcon from './StudySpeakerIcon';

export interface AudioPlayerHandle {
  play: () => Promise<boolean>;
  stop: () => void;
}

interface StudyAudioPlayerProps {
  listeningPrompt?: boolean;
  filename?: string | null;
  label: string;
  renderMode?: 'default' | 'hidden';
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
      listeningPrompt = false,
      label,
      renderMode = 'default',
      size = 'default',
      showTimeline = false,
      timelineMode = 'always',
      testId,
      url,
    },
    ref
  ) => {
    const { t } = useTranslation('study');
    const replayHost = useContext(StudyReplayHost);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const playAttemptRef = useRef(0);
    const [playing, setPlaying] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useWarmAudioCache([url]);

    const setPlayingState = useCallback((nextPlaying: boolean) => {
      setPlaying(nextPlaying);
    }, []);

    const stop = useCallback(() => {
      playAttemptRef.current += 1;
      const audio = audioRef.current;
      if (!audio) return;
      if (!audio.paused) {
        audio.pause();
      }
      try {
        audio.currentTime = 0;
      } catch (error) {
        if (!(error instanceof DOMException)) {
          throw error;
        }
        // Ignore mobile/browser stop seek failures.
      }
      setPlayingState(false);
    }, [setPlayingState]);

    const play = useCallback(async () => {
      const audio = audioRef.current;
      if (!audio) return false;
      const playAttempt = playAttemptRef.current + 1;
      playAttemptRef.current = playAttempt;

      try {
        setErrorMessage(null);
        if (!audio.paused) {
          audio.pause();
        }
        try {
          audio.currentTime = 0;
        } catch {
          // Some mobile browsers reject seeking before metadata is available. Playback can
          // still start from the beginning, so do not turn that into a failed tap.
        }
        if (audio.networkState === HTMLMediaElement.NETWORK_EMPTY) {
          audio.load();
        }
        // Autoplay and manual replay intentionally share the same error surface because
        // browsers like iOS Safari may reject play() until media is user-gesture eligible.
        await audio.play();
        if (playAttemptRef.current !== playAttempt) return false;
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
      audio.addEventListener('playing', handlePlay);
      audio.addEventListener('waiting', handlePause);
      audio.addEventListener('seeking', handlePause);
      audio.addEventListener('canplay', handleCanPlay);
      audio.addEventListener('error', handleError);

      return () => {
        playAttemptRef.current += 1;
        if (!audio.paused) {
          audio.pause();
        }
        try {
          audio.currentTime = 0;
        } catch {
          // Ignore mobile/browser cleanup seek failures.
        }
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('pause', handlePause);
        audio.removeEventListener('playing', handlePlay);
        audio.removeEventListener('waiting', handlePause);
        audio.removeEventListener('seeking', handlePause);
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

    const showControls = renderMode !== 'hidden';
    const showButton = showControls && (!showTimeline || timelineMode === 'desktop');
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
        {replayHost &&
          showButton &&
          createPortal(
            <button
              type="button"
              className="study-toolbar-replay"
              onClick={handleClick}
              aria-label={listeningPrompt ? t('reviewHeader.replay') : label}
              data-playing={playing}
              data-testid={listeningPrompt ? undefined : testId && `${testId}-button`}
            >
              <span className="study-replay-tile">
                <StudySpeakerIcon playing={playing} />
              </span>
              <span>{t('reviewHeader.replay')}</span>
            </button>,
            replayHost
          )}
        {showButton && (!replayHost || listeningPrompt) ? (
          <div className={buttonClasses}>
            <button
              type="button"
              onClick={handleClick}
              onKeyDown={(event) => {
                event.stopPropagation();
              }}
              aria-label={label}
              data-playing={playing}
              data-testid={testId ? `${testId}-button` : undefined}
              className={`study-speaker-button inline-flex items-center justify-center rounded-full border border-gray-400 bg-white text-navy shadow-sm transition hover:border-navy hover:shadow-md ${
                playing ? 'ring-2 ring-navy/20' : ''
              } ${buttonSizeClasses}`}
            >
              <span className={`study-speaker-glyph ${iconSizeClasses}`}>
                {listeningPrompt ? (
                  <StudySpeakerIcon playing={playing} />
                ) : (
                  <Volume2 aria-hidden="true" />
                )}
              </span>
            </button>
          </div>
        ) : null}

        <span className="sr-only" role="status">
          {playing ? t('preview.audioPlaying') : ''}
        </span>
        <audio
          key={url}
          ref={audioRef}
          preload={audioPreload}
          controls={showControls && showTimeline}
          aria-label={label}
          data-testid={testId ? `${testId}-element` : undefined}
          className={showControls && showTimeline ? timelineClasses : 'sr-only'}
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
