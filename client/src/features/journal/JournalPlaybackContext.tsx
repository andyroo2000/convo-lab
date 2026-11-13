import { useContext, type ReactNode } from 'react';
import { PlaybackContext, usePlaybackState } from './useJournalPlayback';

const JournalPlaybackProvider = ({ children }: { children: ReactNode }) => {
  const playback = usePlaybackState();
  return <PlaybackContext.Provider value={playback}>{children}</PlaybackContext.Provider>;
};
export const JournalPlaybackBoundary = ({ children }: { children: ReactNode }) => {
  const context = useContext(PlaybackContext);
  return context ? children : <JournalPlaybackProvider>{children}</JournalPlaybackProvider>;
};
export default JournalPlaybackProvider;
