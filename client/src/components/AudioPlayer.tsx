import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export type RepeatMode = 'off' | 'one' | 'all';

interface AudioPlayerProps {
  src: string;
  audioRef: (element: HTMLAudioElement | null) => void;
  repeatMode?: RepeatMode;
  onRepeatModeChange?: (mode: RepeatMode) => void;
  onEnded?: () => void;
}

const AudioPlayer = ({
  src,
  audioRef,
  repeatMode = 'off',
  onRepeatModeChange,
  onEnded,
}: AudioPlayerProps) => {
  const { t } = useTranslation('common');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Combined ref callback that updates both our local ref and parent's ref
  const combinedRef = useCallback(
    (element: HTMLAudioElement | null) => {
      audioElementRef.current = element;
      audioRef(element);
    },
    [audioRef]
  );

  // Set up event listeners when audio element is available
  useEffect(() => {
    const element = audioElementRef.current;
    if (!element) return undefined;

    const updateDuration = () => setDuration(element.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (onEnded) {
        onEnded();
      }
    };

    element.addEventListener('loadedmetadata', updateDuration);
    element.addEventListener('play', handlePlay);
    element.addEventListener('pause', handlePause);
    element.addEventListener('ended', handleEnded);

    return () => {
      element.removeEventListener('loadedmetadata', updateDuration);
      element.removeEventListener('play', handlePlay);
      element.removeEventListener('pause', handlePause);
      element.removeEventListener('ended', handleEnded);
    };
  }, [src, onEnded]); // Re-run when src or onEnded changes

  // Smooth progress updates using requestAnimationFrame - runs continuously
  useEffect(() => {
    let animationFrameId: number;
    const updateProgress = () => {
      const audio = audioElementRef.current;
      if (audio && !isDragging) {
        setCurrentTime(audio.currentTime);
        // Update isPlaying state based on audio element's state
        setIsPlaying(!audio.paused);
      }
      animationFrameId = requestAnimationFrame(updateProgress);
    };

    animationFrameId = requestAnimationFrame(updateProgress);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isDragging]);

  const togglePlayPause = () => {
    const audio = audioElementRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioElementRef.current;
    const progressBar = progressBarRef.current;
    if (!audio || !progressBar) return;

    const rect = progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audio.currentTime = percent * duration;
  };

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    handleProgressClick(e);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const formatTime = (seconds: number) => {
    if (Number.isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleRepeatMode = () => {
    if (!onRepeatModeChange) return;
    const modes: RepeatMode[] = ['off', 'one', 'all'];
    const currentIndex = modes.indexOf(repeatMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    onRepeatModeChange(modes[nextIndex]);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 w-full">
      <audio ref={combinedRef} src={src} />

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlayPause}
        className="w-10 h-10 flex items-center justify-center rounded-full bg-indigo text-white hover:bg-indigo-600 transition-colors flex-shrink-0"
        aria-label={isPlaying ? t('aria.pause') : t('aria.play')}
        data-testid="audio-button-play-pause"
      >
        {isPlaying ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Current Time */}
      <span className="text-sm text-navy font-medium tabular-nums flex-shrink-0 w-12">
        {formatTime(currentTime)}
      </span>

      {/* Progress Bar */}
      <div
        ref={progressBarRef}
        role="button"
        tabIndex={0}
        className="flex-1 h-2 bg-gray-200 rounded-full cursor-pointer relative group"
        onClick={handleProgressClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleProgressClick(e as unknown as React.MouseEvent<HTMLDivElement>);
          }
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        data-testid="audio-progress-bar"
      >
        {/* Progress Fill */}
        <div className="h-full bg-indigo rounded-full relative" style={{ width: `${progress}%` }}>
          {/* Playhead */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-indigo rounded-full border-2 border-white shadow-md" />
        </div>
      </div>

      {/* Duration */}
      <span className="text-sm text-gray-500 font-medium tabular-nums flex-shrink-0 w-12">
        {formatTime(duration)}
      </span>

      {/* Repeat Button */}
      {onRepeatModeChange && (
        <button
          type="button"
          onClick={toggleRepeatMode}
          className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors flex-shrink-0 ${
            repeatMode !== 'off'
              ? 'bg-indigo text-white hover:bg-indigo-600'
              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
          }`}
          aria-label={t('aria.repeatMode', { mode: repeatMode })}
          data-testid="audio-button-repeat"
        >
          {(() => {
            if (repeatMode === 'one') {
              return (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                  <text
                    x="12"
                    y="16"
                    fontSize="8"
                    fill="currentColor"
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    1
                  </text>
                </svg>
              );
            }
            if (repeatMode === 'all') {
              return (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              );
            }
            return (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            );
          })()}
        </button>
      )}
    </div>
  );
};

export default AudioPlayer;
