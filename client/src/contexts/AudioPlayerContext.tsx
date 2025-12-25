import { createContext, useContext, useState, useMemo, ReactNode } from 'react';

interface AudioPlayerContextType {
  audioUrl: string | null;
  title: string | null;
  speed: string | null;
  setAudioInfo: (url: string | null, title: string | null, speed: string | null) => void;
  clearAudio: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

export const AudioPlayerProvider = ({ children }: { children: ReactNode }) => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [speed, setSpeed] = useState<string | null>(null);

  const setAudioInfo = (url: string | null, newTitle: string | null, newSpeed: string | null) => {
    setAudioUrl(url);
    setTitle(newTitle);
    setSpeed(newSpeed);
  };

  const clearAudio = () => {
    setAudioUrl(null);
    setTitle(null);
    setSpeed(null);
  };

  const value = useMemo(
    () => ({ audioUrl, title, speed, setAudioInfo, clearAudio }),
    [audioUrl, title, speed]
  );

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
};

export function useAudioPlayerContext() {
  const context = useContext(AudioPlayerContext);
  if (context === undefined) {
    throw new Error('useAudioPlayerContext must be used within an AudioPlayerProvider');
  }
  return context;
}
