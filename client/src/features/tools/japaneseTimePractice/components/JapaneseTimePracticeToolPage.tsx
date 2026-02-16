import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  generateJapaneseDateTimeReading,
  parseLocalDateTimeInput,
  toLocalDateInputValue,
} from '../../japaneseDate/logic/readingEngine';
import {
  buildTimeAudioClipUrls,
  playAudioClipSequence,
  type AudioSequencePlayback,
} from '../../japaneseDate/logic/preRenderedTimeAudio';
import {
  createInitialFsrsSessionState,
  pickNextFsrsCard,
  reviewFsrsCard,
  type FsrsGrade,
  type FsrsSessionState,
} from '../logic/fsrsSession';
import trackTimePracticeEvent from '../logic/analytics';
import { loadTimePracticeLocalState, saveTimePracticeLocalState } from '../logic/localStorageState';
import {
  createRandomTimeCard,
  createTimeCard,
  DEFAULT_TIME_PRACTICE_SETTINGS,
  type TimePracticeCard,
  type TimePracticeMode,
} from '../logic/types';

interface RubyPartProps {
  script: string;
  kana: string;
  showFurigana: boolean;
}

const toTwoDigits = (value: number) => String(value).padStart(2, '0');
const PAUSE_OPTIONS = [5, 8, 12] as const;
const GRADE_OPTIONS: ReadonlyArray<{ grade: FsrsGrade; label: string }> = [
  { grade: 'again', label: 'Again' },
  { grade: 'hard', label: 'Hard' },
  { grade: 'good', label: 'Good' },
  { grade: 'easy', label: 'Easy' },
];
const RUBY_RT_CLASS = '!text-[0.34em] sm:!text-[0.27em]';

const createCurrentLocalTimeCard = (): TimePracticeCard => {
  const now = new Date();
  return createTimeCard(now.getHours(), now.getMinutes());
};

const RubyPart = ({ script, kana, showFurigana }: RubyPartProps) => (
  <ruby className="mr-1">
    {script}
    <rt className={`${RUBY_RT_CLASS} ${showFurigana ? '' : 'invisible'}`}>{kana}</rt>
  </ruby>
);

const UnitRubyPart = ({ script, kana, showFurigana }: RubyPartProps) => {
  if (script.endsWith('時') && kana.endsWith('じ')) {
    const numberScript = script.slice(0, -1);
    const numberKana = kana.slice(0, -1);
    return (
      <span className="mr-1 inline-flex items-start">
        <ruby>
          {numberScript}
          <rt className={`${RUBY_RT_CLASS} ${showFurigana ? '' : 'invisible'}`}>{numberKana}</rt>
        </ruby>
        <ruby>
          時<rt className={`${RUBY_RT_CLASS} ${showFurigana ? '' : 'invisible'}`}>じ</rt>
        </ruby>
      </span>
    );
  }

  if (script.endsWith('分') && (kana.endsWith('ふん') || kana.endsWith('ぷん'))) {
    const unitKana = kana.endsWith('ふん') ? 'ふん' : 'ぷん';
    const numberScript = script.slice(0, -1);
    const numberKana = kana.slice(0, -unitKana.length);
    return (
      <span className="mr-1 inline-flex items-start">
        <ruby>
          {numberScript}
          <rt className={`${RUBY_RT_CLASS} ${showFurigana ? '' : 'invisible'}`}>{numberKana}</rt>
        </ruby>
        <ruby>
          分<rt className={`${RUBY_RT_CLASS} ${showFurigana ? '' : 'invisible'}`}>{unitKana}</rt>
        </ruby>
      </span>
    );
  }

  return <RubyPart script={script} kana={kana} showFurigana={showFurigana} />;
};

const JapaneseTimePracticeToolPage = () => {
  const initialState = useMemo(() => loadTimePracticeLocalState(), []);

  const [mode, setMode] = useState<TimePracticeMode>(() => initialState?.mode ?? 'random');
  const [card, setCard] = useState<TimePracticeCard>(
    () => initialState?.currentCard ?? createCurrentLocalTimeCard()
  );
  const [settings, setSettings] = useState(() => {
    if (!initialState) {
      return DEFAULT_TIME_PRACTICE_SETTINGS;
    }

    return {
      ...initialState.settings,
      revealDelaySeconds: initialState.ui.pauseSeconds,
    };
  });
  const [fsrsState, setFsrsState] = useState<FsrsSessionState>(
    () => initialState?.fsrsState ?? createInitialFsrsSessionState()
  );
  const [isPowerOn, setIsPowerOn] = useState(() => initialState?.ui.isPowerOn ?? false);
  const [volumeLevel, setVolumeLevel] = useState<number>(() => initialState?.ui.volumeLevel ?? 1);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isNextLedActive, setIsNextLedActive] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [playbackHint, setPlaybackHint] = useState<string | null>(null);

  const revealTimerRef = useRef<number | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const nextLedTimerRef = useRef<number | null>(null);
  const playbackRef = useRef<AudioSequencePlayback | null>(null);
  const isFirstPowerOnRef = useRef(true);

  const pauseSeconds = settings.revealDelaySeconds;
  const localDate = useMemo(() => toLocalDateInputValue(new Date()), []);
  const timeValue = useMemo(
    () => `${toTwoDigits(card.hour24)}:${toTwoDigits(card.minute)}`,
    [card.hour24, card.minute]
  );

  const reading = useMemo(
    () =>
      generateJapaneseDateTimeReading(parseLocalDateTimeInput(localDate, timeValue), {
        hourFormat: '24h',
      }),
    [localDate, timeValue]
  );

  const digitalDisplay = `${toTwoDigits(card.hour24)}:${toTwoDigits(card.minute)}`;
  const shouldShowScript = isRevealed && settings.displayMode === 'script';
  const statusText = (() => {
    if (mode !== 'random' || !isPowerOn || countdownSeconds === null) return '';
    if (!isRevealed) return `answer in ${countdownSeconds}s`;
    if (!isPlaying) return `replaying in ${countdownSeconds}s`;
    return '';
  })();

  const clearRevealTimer = useCallback(() => {
    if (revealTimerRef.current !== null) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  const clearAutoAdvanceTimer = useCallback(() => {
    if (autoAdvanceTimerRef.current !== null) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  const clearCountdownInterval = useCallback(() => {
    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const clearNextLedTimer = useCallback(() => {
    if (nextLedTimerRef.current !== null) {
      window.clearTimeout(nextLedTimerRef.current);
      nextLedTimerRef.current = null;
    }
  }, []);

  const stopPlayback = useCallback(() => {
    playbackRef.current?.stop();
    playbackRef.current = null;
    setIsPlaying(false);
  }, []);

  const playCurrentCardAudio = useCallback(async () => {
    stopPlayback();

    let currentPlayback: AudioSequencePlayback | null = null;

    try {
      const urls = buildTimeAudioClipUrls({
        hour24: card.hour24,
        minute: card.minute,
        hourFormat: '24h',
      });

      const playback = playAudioClipSequence(urls, { volume: volumeLevel });
      currentPlayback = playback;
      playbackRef.current = playback;
      setIsPlaying(true);
      setPlaybackHint(null);
      await playback.finished;
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError';
      if (!isAbort) {
        trackTimePracticeEvent('audio_play_error', mode);
        setPlaybackHint('Autoplay was blocked. Tap Play or Next to hear audio.');
      }
    } finally {
      if (currentPlayback && playbackRef.current === currentPlayback) {
        playbackRef.current = null;
      }
      setIsPlaying(false);
    }
  }, [card.hour24, card.minute, mode, stopPlayback, volumeLevel]);

  const revealCard = useCallback(() => {
    trackTimePracticeEvent('reveal_answer', mode);
    setIsRevealed(true);
    if (!settings.autoPlayAudio) {
      return;
    }

    playCurrentCardAudio().catch(() => {
      setPlaybackHint('Autoplay was blocked. Tap Play or Next to hear audio.');
    });
  }, [mode, playCurrentCardAudio, settings.autoPlayAudio]);

  const advanceToRandomCard = useCallback(() => {
    setIsRevealed(false);
    setCard(createRandomTimeCard());
  }, []);

  const enterRandomMode = useCallback(() => {
    trackTimePracticeEvent('mode_changed', 'random');
    setMode('random');
    setIsRevealed(false);
    setIsPowerOn(false);
    setCountdownSeconds(null);
    stopPlayback();
    clearAutoAdvanceTimer();
    clearRevealTimer();
    clearCountdownInterval();
    setCard(createRandomTimeCard());
  }, [clearAutoAdvanceTimer, clearCountdownInterval, clearRevealTimer, stopPlayback]);

  const enterFsrsMode = useCallback(() => {
    trackTimePracticeEvent('mode_changed', 'fsrs');
    setMode('fsrs');
    setIsRevealed(false);
    setIsPowerOn(false);
    setCountdownSeconds(null);
    stopPlayback();
    clearAutoAdvanceTimer();
    clearRevealTimer();
    clearCountdownInterval();
    setCard(pickNextFsrsCard(fsrsState, new Date(), settings.maxNewCardsPerDay));
  }, [
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearRevealTimer,
    fsrsState,
    settings.maxNewCardsPerDay,
    stopPlayback,
  ]);

  const handleFsrsGrade = useCallback(
    (grade: FsrsGrade) => {
      trackTimePracticeEvent('fsrs_graded', 'fsrs', { grade });
      const now = new Date();
      const nextState = reviewFsrsCard(fsrsState, card, grade, now);
      setFsrsState(nextState);
      setIsRevealed(false);
      setIsPowerOn(false);
      setCountdownSeconds(null);
      stopPlayback();
      clearAutoAdvanceTimer();
      clearRevealTimer();
      clearCountdownInterval();
      setCard(pickNextFsrsCard(nextState, now, settings.maxNewCardsPerDay));
    },
    [
      card,
      clearAutoAdvanceTimer,
      clearCountdownInterval,
      clearRevealTimer,
      fsrsState,
      settings.maxNewCardsPerDay,
      stopPlayback,
    ]
  );

  const handleNext = useCallback(() => {
    if (mode === 'fsrs') {
      if (!isRevealed) {
        revealCard();
      }
      return;
    }

    clearNextLedTimer();
    setIsNextLedActive(true);
    nextLedTimerRef.current = window.setTimeout(() => {
      setIsNextLedActive(false);
      nextLedTimerRef.current = null;
    }, 1000);

    clearAutoAdvanceTimer();
    clearRevealTimer();
    clearCountdownInterval();
    setCountdownSeconds(null);
    stopPlayback();

    if (isRevealed) {
      trackTimePracticeEvent('next_card_manual', 'random');
      advanceToRandomCard();
      return;
    }

    revealCard();
  }, [
    advanceToRandomCard,
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearNextLedTimer,
    clearRevealTimer,
    isRevealed,
    mode,
    revealCard,
    stopPlayback,
  ]);

  const nextButtonLabel = mode === 'random' && isRevealed ? 'Next' : 'Show Answer';
  const autoPlayButtonLabel = (() => {
    if (mode === 'fsrs') {
      return 'Auto-Play (Random)';
    }
    if (isPowerOn) {
      return 'Stop';
    }
    return 'Auto-Play';
  })();
  const nextButtonAriaLabel = (() => {
    if (mode === 'fsrs') {
      return 'Reveal answer';
    }
    if (isRevealed) {
      return 'Advance to the next item';
    }
    return 'Show answer';
  })();

  useEffect(() => {
    clearAutoAdvanceTimer();
    clearRevealTimer();
    clearCountdownInterval();

    if (mode !== 'random' || !isPowerOn) {
      setCountdownSeconds(null);
      return undefined;
    }

    let cancelled = false;

    if (!isRevealed && isFirstPowerOnRef.current) {
      isFirstPowerOnRef.current = false;
      setCountdownSeconds(null);
      revealCard();
      return undefined;
    }

    setCountdownSeconds(pauseSeconds);
    countdownIntervalRef.current = window.setInterval(() => {
      setCountdownSeconds((current) => {
        if (current === null) return null;
        return Math.max(0, current - 1);
      });
    }, 1000);

    if (isRevealed) {
      autoAdvanceTimerRef.current = window.setTimeout(() => {
        setCountdownSeconds(null);
        const finishAdvance = () => {
          if (!cancelled) {
            advanceToRandomCard();
          }
        };

        if (!settings.autoPlayAudio) {
          finishAdvance();
          return;
        }

        playCurrentCardAudio().then(finishAdvance).catch(finishAdvance);
      }, pauseSeconds * 1000);
    } else {
      revealTimerRef.current = window.setTimeout(() => {
        if (!cancelled) {
          setCountdownSeconds(null);
          revealCard();
        }
      }, pauseSeconds * 1000);
    }

    return () => {
      cancelled = true;
      clearAutoAdvanceTimer();
      clearRevealTimer();
      clearCountdownInterval();
    };
  }, [
    advanceToRandomCard,
    card.id,
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearRevealTimer,
    isPowerOn,
    isRevealed,
    mode,
    pauseSeconds,
    playCurrentCardAudio,
    revealCard,
    settings.autoPlayAudio,
  ]);

  useEffect(() => {
    if (mode !== 'random' || isPowerOn) {
      return undefined;
    }

    clearAutoAdvanceTimer();
    clearCountdownInterval();
    clearRevealTimer();
    setCountdownSeconds(null);
    stopPlayback();

    return () => {
      clearAutoAdvanceTimer();
      clearCountdownInterval();
      clearRevealTimer();
      clearNextLedTimer();
    };
  }, [
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearNextLedTimer,
    clearRevealTimer,
    isPowerOn,
    mode,
    stopPlayback,
  ]);

  useEffect(
    () => () => {
      clearRevealTimer();
      clearAutoAdvanceTimer();
      clearCountdownInterval();
      clearNextLedTimer();
      stopPlayback();
    },
    [
      clearAutoAdvanceTimer,
      clearCountdownInterval,
      clearNextLedTimer,
      clearRevealTimer,
      stopPlayback,
    ]
  );

  useEffect(() => {
    trackTimePracticeEvent('view_loaded', mode);
    // Track first page render only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    saveTimePracticeLocalState({
      mode,
      currentCard: card,
      fsrsState,
      settings,
      ui: {
        pauseSeconds,
        volumeLevel,
        isPowerOn: mode === 'random' ? isPowerOn : false,
      },
    });
  }, [card, fsrsState, isPowerOn, mode, pauseSeconds, settings, volumeLevel]);

  return (
    <div className="space-y-5">
      <section className="card retro-paper-panel">
        <div className="mb-5 rounded border-2 border-[#0f3561] bg-gradient-to-br from-[#102d57] via-[#143b6f] to-[#184779] px-4 pt-6 pb-7 text-[#f7f6ef] shadow-[0_6px_0_rgba(17,51,92,0.26)] sm:px-5 sm:pt-7 sm:pb-8">
          <p className="pb-3 text-[clamp(1.45rem,1.05rem+1.8vw,2.5rem)] font-semibold leading-[1.05] tracking-[0.04em] text-[#8fd3ea]">
            日本語タイムトレーナー
          </p>
          <p className="retro-headline mt-1 text-[clamp(1.4rem,1rem+1.7vw,2.05rem)] leading-[1.08] text-[#f9f8ed]">
            READ IT.
            <span className="mx-2 text-[#37b4d7]">LISTEN.</span>
            CHECK YOUR ANSWER.
          </p>
          <p className="mt-2 text-sm font-semibold leading-tight text-[#d3ecf4] sm:text-base">
            A time appears first. Say it in Japanese before reveal, then compare with the audio.
          </p>
        </div>

        <div className="mb-4 rounded border border-[#173b6538] bg-[#edf5f9] px-3 py-3 shadow-[0_3px_0_rgba(17,51,92,0.12)] sm:px-4">
          <div className="flex items-center justify-between gap-2">
            <span className="retro-clock-radio-control-label">Mode</span>
            <div className="retro-clock-radio-pause-options">
              <button
                type="button"
                onClick={enterRandomMode}
                className={`retro-clock-radio-pause-button ${mode === 'random' ? 'is-active' : ''}`}
                aria-pressed={mode === 'random'}
              >
                Random
              </button>
              <button
                type="button"
                onClick={enterFsrsMode}
                className={`retro-clock-radio-pause-button ${mode === 'fsrs' ? 'is-active' : ''}`}
                aria-pressed={mode === 'fsrs'}
              >
                FSRS
              </button>
            </div>
          </div>
        </div>

        <div className="retro-clock-radio-shell">
          <div className="retro-clock-radio-body">
            <div className="retro-clock-radio-window">
              <div className="retro-clock-radio-glow" />
              {statusText && <p className="retro-clock-radio-status">{statusText}</p>}
              {shouldShowScript ? (
                <p className="japanese-text retro-clock-radio-script">
                  <UnitRubyPart
                    script={reading.parts.hourScript}
                    kana={reading.parts.hourKana}
                    showFurigana={settings.showFurigana}
                  />
                  <UnitRubyPart
                    script={reading.parts.minuteScript}
                    kana={reading.parts.minuteKana}
                    showFurigana={settings.showFurigana}
                  />
                </p>
              ) : (
                <p className="retro-clock-radio-digital">{digitalDisplay}</p>
              )}
            </div>
          </div>
          <div className="retro-clock-radio-controls">
            <div className="retro-clock-radio-transport">
              <div className="retro-clock-radio-autoplay-stack">
                <span className={`retro-clock-radio-led ${isPowerOn ? 'is-on' : 'is-off'}`} />
                <button
                  type="button"
                  onClick={() => {
                    setIsPowerOn((current) => {
                      const next = !current;
                      trackTimePracticeEvent('autoplay_toggled', mode, { enabled: next });
                      setSettings((currentSettings) => ({
                        ...currentSettings,
                        randomAutoLoop: next,
                      }));
                      return next;
                    });
                  }}
                  className={`retro-clock-radio-action ${isPowerOn ? 'is-active' : ''}`}
                  aria-pressed={isPowerOn}
                  disabled={mode === 'fsrs'}
                >
                  {autoPlayButtonLabel}
                </button>
              </div>
              <div className="retro-clock-radio-next-stack">
                <span
                  className={`retro-clock-radio-led retro-clock-radio-led-next ${isNextLedActive ? 'is-flash' : ''}`}
                />
                <button
                  type="button"
                  onClick={handleNext}
                  className="retro-clock-radio-action"
                  aria-label={nextButtonAriaLabel}
                >
                  {nextButtonLabel}
                </button>
              </div>
            </div>
            <div className="retro-clock-radio-volume" role="group" aria-label="Volume">
              <span className="retro-clock-radio-control-label">Volume</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(volumeLevel * 100)}
                onChange={(event) => {
                  const nextVolume = Number(event.target.value) / 100;
                  setVolumeLevel(nextVolume);
                  playbackRef.current?.setVolume(nextVolume);
                }}
                className="retro-clock-radio-volume-slider"
                aria-label={`Volume ${Math.round(volumeLevel * 100)} percent`}
              />
            </div>
            <div className="retro-clock-radio-pause-group" role="group" aria-label="Pause length">
              <span className="retro-clock-radio-control-label">
                Pause Length (In Auto-Play Mode)
              </span>
              <div className="retro-clock-radio-pause-options">
                {PAUSE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      trackTimePracticeEvent('pause_length_changed', mode, { seconds: option });
                      setSettings((currentSettings) => ({
                        ...currentSettings,
                        revealDelaySeconds: option,
                      }));
                    }}
                    className={`retro-clock-radio-pause-button ${pauseSeconds === option ? 'is-active' : ''}`}
                    aria-pressed={pauseSeconds === option}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div
              className="retro-clock-radio-pause-group"
              role="group"
              aria-label="Display settings"
            >
              <span className="retro-clock-radio-control-label">Display</span>
              <div className="retro-clock-radio-pause-options">
                <button
                  type="button"
                  onClick={() => {
                    trackTimePracticeEvent('display_mode_changed', mode, {
                      display_mode: 'script',
                    });
                    setSettings((currentSettings) => ({
                      ...currentSettings,
                      displayMode: 'script',
                    }));
                  }}
                  className={`retro-clock-radio-pause-button ${settings.displayMode === 'script' ? 'is-active' : ''}`}
                  aria-pressed={settings.displayMode === 'script'}
                >
                  Script
                </button>
                <button
                  type="button"
                  onClick={() => {
                    trackTimePracticeEvent('display_mode_changed', mode, {
                      display_mode: 'digital',
                    });
                    setSettings((currentSettings) => ({
                      ...currentSettings,
                      displayMode: 'digital',
                    }));
                  }}
                  className={`retro-clock-radio-pause-button ${settings.displayMode === 'digital' ? 'is-active' : ''}`}
                  aria-pressed={settings.displayMode === 'digital'}
                >
                  Digital
                </button>
                <button
                  type="button"
                  onClick={() => {
                    trackTimePracticeEvent('furigana_toggled', mode, {
                      enabled: !settings.showFurigana,
                    });
                    setSettings((currentSettings) => ({
                      ...currentSettings,
                      showFurigana: !currentSettings.showFurigana,
                    }));
                  }}
                  className={`retro-clock-radio-pause-button ${settings.showFurigana ? 'is-active' : ''}`}
                  aria-pressed={settings.showFurigana}
                >
                  Furigana
                </button>
              </div>
            </div>
          </div>
        </div>

        {mode === 'fsrs' && isRevealed && (
          <div className="mt-4 rounded border border-[#173b6538] bg-[#edf5f9] px-3 py-3 shadow-[0_3px_0_rgba(17,51,92,0.12)] sm:px-4">
            <p className="retro-clock-radio-control-label">Grade this card</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {GRADE_OPTIONS.map((option) => (
                <button
                  key={option.grade}
                  type="button"
                  onClick={() => handleFsrsGrade(option.grade)}
                  className="retro-clock-radio-pause-button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 rounded border border-[#173b6538] bg-[#edf5f9] px-3 py-3 shadow-[0_3px_0_rgba(17,51,92,0.12)] sm:px-4">
          <ul className="list-disc pl-5 text-sm font-semibold leading-snug text-[#1b3f69] sm:text-[0.96rem]">
            <li>
              Use <span className="retro-caps text-[#15355a]">Show Answer + Next</span> for manual
              practice at your pace.
            </li>
            <li>
              Switch to <span className="retro-caps text-[#15355a]">Auto-Play</span> to get a
              nonstop quiz loop on the selected pause length.
            </li>
          </ul>
        </div>
        {playbackHint && <p className="mt-3 text-sm text-[#9e4c2a]">{playbackHint}</p>}
      </section>
    </div>
  );
};

export default JapaneseTimePracticeToolPage;
