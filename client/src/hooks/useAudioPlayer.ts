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
        console.log('Audio metadata loaded, duration:', audioElementRef.current.duration);
        setDuration(audioElementRef.current.duration);
      }
    },
    handlePlay: () => {
      console.log('Audio started playing');
      setIsPlaying(true);
    },
    handlePause: () => {
      console.log('Audio paused');
      setIsPlaying(false);
    },
    handleEnded: () => {
      console.log('Audio ended');
      setIsPlaying(false);
      setCurrentTime(0);
    },
  });

  const audioRef = useCallback((element: HTMLAudioElement | null) => {
    // Clean up previous element
    if (audioElementRef.current) {
      console.log('useAudioPlayer: cleaning up previous audio element');
      const prevAudio = audioElementRef.current;
      prevAudio.removeEventListener('timeupdate', handlersRef.current.handleTimeUpdate);
      prevAudio.removeEventListener('loadedmetadata', handlersRef.current.handleLoadedMetadata);
      prevAudio.removeEventListener('play', handlersRef.current.handlePlay);
      prevAudio.removeEventListener('pause', handlersRef.current.handlePause);
      prevAudio.removeEventListener('ended', handlersRef.current.handleEnded);
    }

    // Set up new element
    if (element) {
      console.log('useAudioPlayer: setting up new audio element');
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
