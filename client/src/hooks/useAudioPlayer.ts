import { useState, useCallback, useRef } from 'react';

interface UseAudioPlayerReturn {
  audioRef: (element: HTMLAudioElement | null) => void;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
}

export function useAudioPlayer(): UseAudioPlayerReturn {
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Store handlers in refs so they can be properly removed during cleanup
  const handlersRef = useRef({
    handleTimeUpdate: () => {
      if (audioElementRef.current) {
        setCurrentTime(audioElementRef.current.currentTime);
      }
    },
    handleLoadedMetadata: () => {
      if (audioElementRef.current) {
        setDuration(audioElementRef.current.duration);
      }
    },
    handlePlay: () => {
      setIsPlaying(true);
    },
    handlePause: () => {
      setIsPlaying(false);
    },
    handleEnded: () => {
      setIsPlaying(false);
      setCurrentTime(0);
    },
  });

  const audioRef = useCallback((element: HTMLAudioElement | null) => {
    // Clean up previous element
    if (audioElementRef.current) {
      const prevAudio = audioElementRef.current;
      prevAudio.removeEventListener('timeupdate', handlersRef.current.handleTimeUpdate);
      prevAudio.removeEventListener('loadedmetadata', handlersRef.current.handleLoadedMetadata);
      prevAudio.removeEventListener('play', handlersRef.current.handlePlay);
      prevAudio.removeEventListener('pause', handlersRef.current.handlePause);
      prevAudio.removeEventListener('ended', handlersRef.current.handleEnded);
    }

    // Set up new element
    if (element) {
      audioElementRef.current = element;

      element.addEventListener('timeupdate', handlersRef.current.handleTimeUpdate);
      element.addEventListener('loadedmetadata', handlersRef.current.handleLoadedMetadata);
      element.addEventListener('play', handlersRef.current.handlePlay);
      element.addEventListener('pause', handlersRef.current.handlePause);
      element.addEventListener('ended', handlersRef.current.handleEnded);
    } else {
      audioElementRef.current = null;
    }
  }, []);

  const play = () => {
    audioElementRef.current?.play();
  };

  const pause = () => {
    audioElementRef.current?.pause();
  };

  const seek = (time: number) => {
    if (audioElementRef.current) {
      audioElementRef.current.currentTime = time;
    }
  };

  return {
    audioRef,
    currentTime,
    duration,
    isPlaying,
    play,
    pause,
    seek,
  };
}
