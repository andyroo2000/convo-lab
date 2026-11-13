import { useEffect } from 'react';
import { useStudyActivityActions } from '../../contexts/StudyActivityContext';

export default function useJournalActivity(userId: string) {
  const { trackReading } = useStudyActivityActions();

  useEffect(() => {
    if (!userId) return undefined;
    let finish: (() => void) | undefined;
    const pause = () => {
      finish?.();
      finish = undefined;
    };
    const resume = () => {
      if (document.visibilityState === 'visible' && !finish)
        finish = trackReading('Journal', 'journal');
    };
    const visibilityChanged = () => {
      if (document.visibilityState === 'visible') resume();
      else pause();
    };
    resume();
    document.addEventListener('visibilitychange', visibilityChanged);
    window.addEventListener('pagehide', pause);
    window.addEventListener('pageshow', resume);
    return () => {
      pause();
      document.removeEventListener('visibilitychange', visibilityChanged);
      window.removeEventListener('pagehide', pause);
      window.removeEventListener('pageshow', resume);
    };
  }, [trackReading, userId]);
}
