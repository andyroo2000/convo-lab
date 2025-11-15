import { useEffect, useRef, useState, useCallback } from 'react';

interface AudioPlayerProps {
  src: string;
  audioRef: (element: HTMLAudioElement | null) => void;
}

export default function AudioPlayer({ src, audioRef }: AudioPlayerProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Combined ref callback that updates both our local ref and parent's ref
  const combinedRef = useCallback((element: HTMLAudioElement | null) => {
    audioElementRef.current = element;
    audioRef(element);

    if (!element) return;

    const updateDuration = () => setDuration(element.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
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
  }, [audioRef]);

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
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 w-full">
      <audio
        ref={combinedRef}
        src={src}
      />

      {/* Play/Pause Button */}
      <button
        onClick={togglePlayPause}
        className="w-10 h-10 flex items-center justify-center rounded-full bg-indigo text-white hover:bg-indigo-600 transition-colors flex-shrink-0"
        aria-label={isPlaying ? 'Pause' : 'Play'}
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
        className="flex-1 h-2 bg-gray-200 rounded-full cursor-pointer relative group"
        onClick={handleProgressClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Progress Fill */}
        <div
          className="h-full bg-indigo rounded-full relative"
          style={{ width: `${progress}%` }}
        >
          {/* Playhead */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-indigo rounded-full border-2 border-white shadow-md" />
        </div>
      </div>

      {/* Duration */}
      <span className="text-sm text-gray-500 font-medium tabular-nums flex-shrink-0 w-12">
        {formatTime(duration)}
      </span>
    </div>
  );
}
