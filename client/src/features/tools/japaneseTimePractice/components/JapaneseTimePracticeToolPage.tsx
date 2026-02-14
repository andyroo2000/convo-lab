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
const REVEAL_DELAY_SECONDS = 5;
const REVEAL_HOLD_SECONDS = 5;

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
    loopStatus = `Revealed. Replaying in ${REVEAL_HOLD_SECONDS}s.`;
  } else if (isPowerOn) {
    loopStatus = `Waiting ${REVEAL_DELAY_SECONDS}s pause before reveal.`;
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

  useEffect(() => {
    clearRevealTimer();
    clearAutoAdvanceTimer();
    stopPlayback();
    setIsRevealed(false);
    if (!isPowerOn) return undefined;

    revealTimerRef.current = window.setTimeout(() => {
      revealCard();
    }, REVEAL_DELAY_SECONDS * 1000);

    return () => {
      clearRevealTimer();
    };
  }, [card.id, clearAutoAdvanceTimer, clearRevealTimer, isPowerOn, revealCard, stopPlayback]);

  useEffect(() => {
    if (isPowerOn) {
      setCard(createRandomTimeCard());
      return;
    }

    clearAutoAdvanceTimer();
    clearRevealTimer();
    stopPlayback();
    setIsRevealed(false);
  }, [clearAutoAdvanceTimer, clearRevealTimer, isPowerOn, stopPlayback]);

  useEffect(() => {
    clearAutoAdvanceTimer();
    if (!isPowerOn || !isRevealed) return undefined;

    let cancelled = false;

    autoAdvanceTimerRef.current = window.setTimeout(() => {
      const advanceToNextCard = () => {
        if (!cancelled) {
          setCard(createRandomTimeCard());
        }
      };

      playCurrentCardAudio().then(advanceToNextCard).catch(advanceToNextCard);
    }, REVEAL_HOLD_SECONDS * 1000);

    return () => {
      cancelled = true;
      clearAutoAdvanceTimer();
    };
  }, [clearAutoAdvanceTimer, isPowerOn, isRevealed, playCurrentCardAudio]);

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
        <div className="retro-clock-radio-shell">
          <div className="retro-clock-radio-control">
            <span className={`retro-clock-radio-led ${isPowerOn ? 'is-on' : 'is-off'}`} />
            <span className="retro-clock-radio-control-label">Power</span>
            <button
              type="button"
              onClick={() => setIsPowerOn((current) => !current)}
              className="retro-clock-radio-knob retro-clock-radio-knob-button"
              aria-pressed={isPowerOn}
            />
            <span className="retro-clock-radio-control-sub">
              {isPowerOn ? 'Stop Auto Play' : 'Start Auto Play'}
            </span>
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
            <div className="retro-clock-radio-knob" />
            <span className="retro-clock-radio-control-sub">{REVEAL_DELAY_SECONDS}s</span>
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
