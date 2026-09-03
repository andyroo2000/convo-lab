import { useCallback, useMemo, useState } from 'react';

import { createInitialFsrsSessionState, type FsrsSessionState } from '../logic/fsrsSession';
import trackTimePracticeEvent from '../logic/analytics';
import { loadTimePracticeLocalState } from '../logic/localStorageState';
import {
  createTimeCard,
  DEFAULT_TIME_PRACTICE_SETTINGS,
  type TimePracticeCard,
  type TimePracticeSettings,
} from '../logic/types';

const createCurrentLocalTimeCard = (): TimePracticeCard => {
  const now = new Date();
  return createTimeCard(now.getHours(), now.getMinutes());
};

const restoredTimePracticeSettings = (
  initialState: ReturnType<typeof loadTimePracticeLocalState>
): TimePracticeSettings => {
  if (!initialState) return DEFAULT_TIME_PRACTICE_SETTINGS;
  return {
    ...initialState.settings,
    revealDelaySeconds: initialState.ui.pauseSeconds,
    showFurigana: true,
    displayMode: 'script',
  };
};

const useTimePracticeState = () => {
  const initialState = useMemo(() => loadTimePracticeLocalState(), []);
  const [card, setCard] = useState<TimePracticeCard>(
    () => initialState?.currentCard ?? createCurrentLocalTimeCard()
  );
  const [settings, setSettings] = useState<TimePracticeSettings>(() =>
    restoredTimePracticeSettings(initialState)
  );
  const [fsrsState] = useState<FsrsSessionState>(
    () => initialState?.fsrsState ?? createInitialFsrsSessionState()
  );
  const [isPowerOn, setIsPowerOn] = useState(() => initialState?.ui.isPowerOn ?? false);
  const handlePowerToggle = useCallback(() => {
    setIsPowerOn((current) => {
      const next = !current;
      trackTimePracticeEvent('autoplay_toggled', 'random', { enabled: next });
      setSettings((currentSettings) => ({
        ...currentSettings,
        randomAutoLoop: next,
      }));
      return next;
    });
  }, []);
  const handlePauseChange = useCallback((seconds: number) => {
    trackTimePracticeEvent('pause_length_changed', 'random', { seconds });
    setSettings((currentSettings) => ({
      ...currentSettings,
      revealDelaySeconds: seconds,
    }));
  }, []);

  return {
    card,
    fsrsState,
    handlePauseChange,
    handlePowerToggle,
    initialState,
    isPowerOn,
    settings,
    setCard,
  };
};

export default useTimePracticeState;
