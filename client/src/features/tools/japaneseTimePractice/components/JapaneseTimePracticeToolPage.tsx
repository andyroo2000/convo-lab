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
import { createRandomTimeCard, createTimeCard, type TimePracticeCard } from '../logic/types';

interface RubyPartProps {
  script: string;
  kana: string;
  showFurigana: boolean;
}

const toTwoDigits = (value: number) => String(value).padStart(2, '0');
const PAUSE_OPTIONS = [3, 5, 8] as const;
const createCurrentLocalTimeCard = (): TimePracticeCard => {
  const now = new Date();
  return createTimeCard(now.getHours(), now.getMinutes());
};

const RubyPart = ({ script, kana, showFurigana }: RubyPartProps) => (
  <ruby className="mr-1">
    {script}
    <rt className={`!text-[0.27em] ${showFurigana ? '' : 'invisible'}`}>{kana}</rt>
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
          <rt className={`!text-[0.27em] ${showFurigana ? '' : 'invisible'}`}>{numberKana}</rt>
        </ruby>
        <ruby>
          時<rt className={`!text-[0.27em] ${showFurigana ? '' : 'invisible'}`}>じ</rt>
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
          <rt className={`!text-[0.27em] ${showFurigana ? '' : 'invisible'}`}>{numberKana}</rt>
        </ruby>
        <ruby>
          分<rt className={`!text-[0.27em] ${showFurigana ? '' : 'invisible'}`}>{unitKana}</rt>
        </ruby>
      </span>
    );
  }

  return <RubyPart script={script} kana={kana} showFurigana={showFurigana} />;
};

const JapaneseTimePracticeToolPage = () => {
  const [card, setCard] = useState<TimePracticeCard>(createCurrentLocalTimeCard);
  const [isPowerOn, setIsPowerOn] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pauseSeconds, setPauseSeconds] = useState<number>(8);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [playbackHint, setPlaybackHint] = useState<string | null>(null);

  const revealTimerRef = useRef<number | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const playbackRef = useRef<AudioSequencePlayback | null>(null);
  const isFirstPowerOnRef = useRef(true);

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
  const shouldShowScript = isRevealed;
  const statusText = (() => {
    if (!isPowerOn || countdownSeconds === null) return '';
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

      const playback = playAudioClipSequence(urls);
      currentPlayback = playback;
      playbackRef.current = playback;
      setIsPlaying(true);
      setPlaybackHint(null);
      await playback.finished;
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError';
      if (!isAbort) {
        setPlaybackHint('Autoplay was blocked. Tap replay to hear audio.');
      }
    } finally {
      if (currentPlayback && playbackRef.current === currentPlayback) {
        playbackRef.current = null;
      }
      setIsPlaying(false);
    }
  }, [card.hour24, card.minute, stopPlayback]);

  const revealCard = useCallback(() => {
    setIsRevealed(true);
    playCurrentCardAudio().catch(() => {
      setPlaybackHint('Autoplay was blocked. Tap replay to hear audio.');
    });
  }, [playCurrentCardAudio]);

  const advanceToNextCard = useCallback(() => {
    setIsRevealed(false);
    setCard(createRandomTimeCard());
  }, []);

  const cyclePause = useCallback(() => {
    setPauseSeconds((current) => {
      const index = PAUSE_OPTIONS.findIndex((value) => value === current);
      const nextIndex = index === -1 ? 0 : (index + 1) % PAUSE_OPTIONS.length;
      return PAUSE_OPTIONS[nextIndex];
    });
  }, []);

  useEffect(() => {
    clearAutoAdvanceTimer();
    clearRevealTimer();
    clearCountdownInterval();
    if (!isPowerOn) {
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
            advanceToNextCard();
          }
        };

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
    advanceToNextCard,
    card.id,
    clearAutoAdvanceTimer,
    clearCountdownInterval,
    clearRevealTimer,
    isPowerOn,
    isRevealed,
    pauseSeconds,
    playCurrentCardAudio,
    revealCard,
  ]);

  useEffect(() => {
    if (isPowerOn) return undefined;

    clearAutoAdvanceTimer();
    clearCountdownInterval();
    clearRevealTimer();
    setCountdownSeconds(null);
    stopPlayback();

    return () => {
      clearAutoAdvanceTimer();
      clearCountdownInterval();
      clearRevealTimer();
    };
  }, [clearAutoAdvanceTimer, clearCountdownInterval, clearRevealTimer, isPowerOn, stopPlayback]);

  useEffect(
    () => () => {
      clearRevealTimer();
      clearAutoAdvanceTimer();
      clearCountdownInterval();
      stopPlayback();
    },
    [clearAutoAdvanceTimer, clearCountdownInterval, clearRevealTimer, stopPlayback]
  );

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

        <div className="retro-clock-radio-shell">
          <div className="retro-clock-radio-control">
            <span className={`retro-clock-radio-led ${isPowerOn ? 'is-on' : 'is-off'}`} />
            <span className="retro-clock-radio-control-label">Power</span>
            <button
              type="button"
              onClick={() => setIsPowerOn((current) => !current)}
              className="retro-clock-radio-knob retro-clock-radio-knob-button"
              aria-label={isPowerOn ? 'Stop Auto Play' : 'Start Auto Play'}
              aria-pressed={isPowerOn}
            />
          </div>
          <div className="retro-clock-radio-body">
            <div className="retro-clock-radio-window">
              <div className="retro-clock-radio-glow" />
              {statusText && <p className="retro-clock-radio-status">{statusText}</p>}
              {shouldShowScript ? (
                <p className="japanese-text retro-clock-radio-script">
                  <UnitRubyPart
                    script={reading.parts.hourScript}
                    kana={reading.parts.hourKana}
                    showFurigana
                  />
                  <UnitRubyPart
                    script={reading.parts.minuteScript}
                    kana={reading.parts.minuteKana}
                    showFurigana
                  />
                </p>
              ) : (
                <p className="retro-clock-radio-digital">{digitalDisplay}</p>
              )}
            </div>
          </div>
          <div className="retro-clock-radio-control">
            <span className="retro-clock-radio-control-label">Pause Length</span>
            <button
              type="button"
              onClick={cyclePause}
              className="retro-clock-radio-knob retro-clock-radio-knob-button"
              aria-label={`Pause length ${pauseSeconds} seconds between items`}
            />
            <span className="retro-clock-radio-control-sub">{pauseSeconds}s</span>
          </div>
        </div>

        {playbackHint && <p className="mt-3 text-sm text-[#9e4c2a]">{playbackHint}</p>}
      </section>
    </div>
  );
};

export default JapaneseTimePracticeToolPage;
