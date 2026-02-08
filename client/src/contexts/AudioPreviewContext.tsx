import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';

interface AudioPreviewContextType {
  play: (src: string) => Promise<void>;
  stop: () => void;
  currentSrc: string | null;
  isPlaying: boolean;
}

const AudioPreviewContext = createContext<AudioPreviewContextType | undefined>(undefined);

export const AudioPreviewProvider = ({ children }: { children: ReactNode }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentSrc(null);
  }, []);

  const play = useCallback(
    async (src: string) => {
      const audio = audioRef.current;
      if (!audio) return;

      // If already playing this source, stop it
      if (currentSrc === src && isPlaying) {
        stop();
        return;
      }

      // Stop any current playback first
      audio.pause();
      audio.currentTime = 0;
      audio.src = src;

      try {
        await audio.play();
        setCurrentSrc(src);
        setIsPlaying(true);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Voice preview playback failed:', error);
        setIsPlaying(false);
        setCurrentSrc(null);
      }
    },
    [currentSrc, isPlaying, stop]
  );

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentSrc(null);
  }, []);

  const handleError = useCallback(() => {
    setIsPlaying(false);
    setCurrentSrc(null);
  }, []);

  const value = useMemo(
    () => ({ play, stop, currentSrc, isPlaying }),
    [play, stop, currentSrc, isPlaying]
  );

  return (
    <AudioPreviewContext.Provider value={value}>
      {children}
      {/* Single shared audio element for all voice previews */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        preload="none"
        onEnded={handleEnded}
        onError={handleError}
        aria-hidden="true"
      />
    </AudioPreviewContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function useAudioPreview(): AudioPreviewContextType {
  const context = useContext(AudioPreviewContext);
  if (!context) {
    throw new Error('useAudioPreview must be used within an AudioPreviewProvider');
  }
  return context;
}
