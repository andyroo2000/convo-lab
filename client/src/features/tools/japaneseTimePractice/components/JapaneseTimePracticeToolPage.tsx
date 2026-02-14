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
import { createRandomTimeCard, type TimePracticeCard } from '../logic/types';

interface RubyPartProps {
  script: string;
  kana: string;
  showFurigana: boolean;
}

const toTwoDigits = (value: number) => String(value).padStart(2, '0');
const PAUSE_OPTIONS = [3, 5, 8] as const;

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
  const [card, setCard] = useState<TimePracticeCard>(() => createRandomTimeCard());
  const [isPowerOn, setIsPowerOn] = useState(true);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pauseSeconds, setPauseSeconds] = useState<number>(8);
  const [playbackHint, setPlaybackHint] = useState<string | null>(null);

  const revealTimerRef = useRef<number | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const playbackRef = useRef<AudioSequencePlayback | null>(null);

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
  let loopStatus = 'Power off.';
  if (isPowerOn && isRevealed) {
    loopStatus = `Revealed. Replaying in ${pauseSeconds}s.`;
  } else if (isPowerOn) {
    loopStatus = `Waiting ${pauseSeconds}s pause before reveal.`;
  }

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
    if (!isPowerOn) return undefined;

    let cancelled = false;

    if (isRevealed) {
      autoAdvanceTimerRef.current = window.setTimeout(() => {
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
          revealCard();
        }
      }, pauseSeconds * 1000);
    }

    return () => {
      cancelled = true;
      clearAutoAdvanceTimer();
      clearRevealTimer();
    };
  }, [
    advanceToNextCard,
    card.id,
    clearAutoAdvanceTimer,
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
    clearRevealTimer();
    stopPlayback();

    return () => {
      clearAutoAdvanceTimer();
      clearRevealTimer();
    };
  }, [clearAutoAdvanceTimer, clearRevealTimer, isPowerOn, stopPlayback]);

  useEffect(
    () => () => {
      clearRevealTimer();
      clearAutoAdvanceTimer();
      stopPlayback();
    },
    [clearAutoAdvanceTimer, clearRevealTimer, stopPlayback]
  );

  return (
    <div className="space-y-5">
      <section className="card retro-paper-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="retro-headline text-2xl sm:text-3xl">Japanese Time Trainer</h1>
          <p className="text-right text-lg font-semibold text-[#2f4f73] sm:text-xl">
            日本語の時刻練習
          </p>
        </div>
      </section>

      <section className="card retro-paper-panel">
        <div className="mb-4 space-y-2">
          <p className="retro-headline text-lg sm:text-xl">Clock Radio Drill</p>
          <p className="text-sm text-[#2f4f73] sm:text-base">
            Press power and train like an old-school radio quiz: read the clock, wait for the
            reveal, then hear the Japanese.
          </p>
          <p className="text-xs uppercase tracking-[0.08em] text-[#4e3d21] sm:text-sm">
            Power toggles the loop. Pause knob cycles 3s / 5s / 8s.
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
            <span className="retro-clock-radio-control-label">Pause</span>
            <button
              type="button"
              onClick={cyclePause}
              className="retro-clock-radio-knob retro-clock-radio-knob-button"
              aria-label={`Pause ${pauseSeconds} seconds`}
            />
            <span className="retro-clock-radio-control-sub">{pauseSeconds}s</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#2f4f73]">
          <span>{loopStatus}</span>
          {isPlaying && <span>Playing audio...</span>}
          {playbackHint && <span className="text-[#9e4c2a]">{playbackHint}</span>}
        </div>
      </section>
    </div>
  );
};

export default JapaneseTimePracticeToolPage;
