import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, Gauge, Play, Radio, RotateCcw, SkipForward, Volume2 } from 'lucide-react';

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
  createRandomTimeCard,
  DEFAULT_TIME_PRACTICE_SETTINGS,
  type TimePracticeCard,
  type TimePracticeMode,
} from '../logic/types';

type Grade = 'again' | 'hard' | 'good' | 'easy';

interface RubyPartProps {
  script: string;
  kana: string;
  showFurigana: boolean;
}

const toTwoDigits = (value: number) => String(value).padStart(2, '0');

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
  const [mode, setMode] = useState<TimePracticeMode>('fsrs');
  const [card, setCard] = useState<TimePracticeCard>(() => createRandomTimeCard());
  const [settings, setSettings] = useState(DEFAULT_TIME_PRACTICE_SETTINGS);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastGrade, setLastGrade] = useState<Grade | null>(null);
  const [playbackHint, setPlaybackHint] = useState<string | null>(null);

  const revealTimerRef = useRef<number | null>(null);
  const autoLoopTimerRef = useRef<number | null>(null);
  const playbackRef = useRef<AudioSequencePlayback | null>(null);

  const localDate = useMemo(() => toLocalDateInputValue(new Date()), []);
  const timeValue = useMemo(
    () => `${toTwoDigits(card.hour24)}:${toTwoDigits(card.minute)}`,
    [card]
  );

  const reading = useMemo(
    () =>
      generateJapaneseDateTimeReading(parseLocalDateTimeInput(localDate, timeValue), {
        hourFormat: '24h',
      }),
    [localDate, timeValue]
  );

  const digitalDisplay = `${toTwoDigits(card.hour24)}:${toTwoDigits(card.minute)}`;

  const clearRevealTimer = () => {
    if (revealTimerRef.current !== null) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  };

  const clearAutoLoopTimer = () => {
    if (autoLoopTimerRef.current !== null) {
      window.clearTimeout(autoLoopTimerRef.current);
      autoLoopTimerRef.current = null;
    }
  };

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

      if (mode === 'random' && settings.randomAutoLoop) {
        autoLoopTimerRef.current = window.setTimeout(() => {
          setCard(createRandomTimeCard());
        }, 800);
      }
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
  }, [card.hour24, card.minute, mode, settings.randomAutoLoop, stopPlayback]);

  useEffect(() => {
    clearRevealTimer();
    clearAutoLoopTimer();
    stopPlayback();
    setIsRevealed(false);

    revealTimerRef.current = window.setTimeout(() => {
      setIsRevealed(true);
    }, settings.revealDelaySeconds * 1000);

    return () => {
      clearRevealTimer();
    };
  }, [card, settings.revealDelaySeconds, stopPlayback]);

  useEffect(() => {
    if (!isRevealed || !settings.autoPlayAudio) return;

    playCurrentCardAudio().catch(() => {
      setPlaybackHint('Autoplay was blocked. Tap replay to hear audio.');
    });
  }, [isRevealed, playCurrentCardAudio, settings.autoPlayAudio]);

  useEffect(
    () => () => {
      clearRevealTimer();
      clearAutoLoopTimer();
      stopPlayback();
    },
    [stopPlayback]
  );

  const moveToNextCard = () => {
    clearAutoLoopTimer();
    setCard(createRandomTimeCard());
  };

  const handleGrade = (grade: Grade) => {
    setLastGrade(grade);
    moveToNextCard();
  };

  return (
    <div className="space-y-5">
      <section className="card retro-paper-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="retro-headline text-2xl sm:text-3xl">Japanese Time Trainer</h1>
          <p className="text-right text-lg font-semibold text-[#2f4f73] sm:text-xl">
            日本語の時刻練習
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode('fsrs')}
            className={`btn-outline h-[2.6rem] px-4 py-0 ${mode === 'fsrs' ? 'bg-[#173b65] text-[#fbf5e0]' : ''}`}
          >
            FSRS Practice
          </button>
          <button
            type="button"
            onClick={() => setMode('random')}
            className={`btn-outline h-[2.6rem] px-4 py-0 ${mode === 'random' ? 'bg-[#173b65] text-[#fbf5e0]' : ''}`}
          >
            Random Flow
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label htmlFor="time-practice-display-mode" className="space-y-1.5">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#204266]">
              <Gauge className="h-4 w-4" />
              Display
            </span>
            <select
              id="time-practice-display-mode"
              className="input h-[2.9rem]"
              value={settings.displayMode}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  displayMode: event.target.value === 'digital' ? 'digital' : 'script',
                }))
              }
            >
              <option value="script">Script + Kanji</option>
              <option value="digital">Digital Clock</option>
            </select>
          </label>

          <label htmlFor="time-practice-reveal-delay" className="space-y-1.5">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#204266]">
              <Clock3 className="h-4 w-4" />
              Reveal Delay
            </span>
            <select
              id="time-practice-reveal-delay"
              className="input h-[2.9rem]"
              value={settings.revealDelaySeconds}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  revealDelaySeconds: Number.parseInt(event.target.value, 10) || 3,
                }))
              }
            >
              {[2, 3, 4, 5, 6, 7, 8].map((value) => (
                <option key={value} value={value}>
                  {value}s
                </option>
              ))}
            </select>
          </label>

          {mode === 'fsrs' ? (
            <label htmlFor="time-practice-max-new" className="space-y-1.5">
              <span className="text-sm font-semibold text-[#204266]">Max New / Day</span>
              <input
                id="time-practice-max-new"
                type="number"
                min={1}
                max={200}
                className="input h-[2.9rem]"
                value={settings.maxNewCardsPerDay}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    maxNewCardsPerDay: Math.max(
                      1,
                      Math.min(200, Number.parseInt(event.target.value, 10) || 20)
                    ),
                  }))
                }
              />
            </label>
          ) : (
            <div className="space-y-1.5">
              <span className="text-sm font-semibold text-[#204266]">Auto Loop</span>
              <button
                type="button"
                onClick={() =>
                  setSettings((current) => ({
                    ...current,
                    randomAutoLoop: !current.randomAutoLoop,
                  }))
                }
                className={`btn-outline h-[2.9rem] w-full py-0 ${settings.randomAutoLoop ? 'bg-[#173b65] text-[#fbf5e0]' : ''}`}
              >
                {settings.randomAutoLoop ? 'On' : 'Off'}
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            <span className="text-sm font-semibold text-[#204266]">Furigana</span>
            <button
              type="button"
              onClick={() =>
                setSettings((current) => ({
                  ...current,
                  showFurigana: !current.showFurigana,
                }))
              }
              className={`btn-outline h-[2.9rem] w-full py-0 ${settings.showFurigana ? 'bg-[#173b65] text-[#fbf5e0]' : ''}`}
            >
              {settings.showFurigana ? 'Hide Furigana' : 'Show Furigana'}
            </button>
          </div>
        </div>
      </section>

      <section className="card retro-paper-panel">
        <div className="retro-clock-radio-shell">
          <div className="retro-clock-radio-knob retro-clock-radio-knob-left" />
          <div className="retro-clock-radio-body">
            <div className="retro-clock-radio-window">
              <div className="retro-clock-radio-glow" />
              {settings.displayMode === 'digital' ? (
                <p className="retro-clock-radio-digital">{digitalDisplay}</p>
              ) : (
                <p className="japanese-text retro-clock-radio-script">
                  <UnitRubyPart
                    script={reading.parts.hourScript}
                    kana={reading.parts.hourKana}
                    showFurigana={isRevealed && settings.showFurigana}
                  />
                  <UnitRubyPart
                    script={reading.parts.minuteScript}
                    kana={reading.parts.minuteKana}
                    showFurigana={isRevealed && settings.showFurigana}
                  />
                </p>
              )}
            </div>
          </div>
          <div className="retro-clock-radio-knob retro-clock-radio-knob-right" />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsRevealed(true);
            }}
            className="btn-outline h-[2.6rem] px-4 py-0"
          >
            Reveal Now
          </button>

          <button
            type="button"
            onClick={() => {
              playCurrentCardAudio().catch(() => {
                setPlaybackHint('Playback failed. Try replay.');
              });
            }}
            className={`btn-primary inline-flex h-[2.6rem] items-center gap-2 px-4 py-0 ${isPlaying ? 'animate-pulse' : ''}`}
          >
            <Volume2 className="h-4 w-4" />
            {isPlaying ? 'Playing' : 'Replay'}
          </button>

          <button
            type="button"
            onClick={moveToNextCard}
            className="btn-outline inline-flex h-[2.6rem] items-center gap-2 px-4 py-0"
          >
            <RotateCcw className="h-4 w-4" />
            New Time
          </button>
        </div>

        <div className="mt-4 border-t border-[#173b6530] pt-4">
          {mode === 'fsrs' ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleGrade('again')}
                className="btn-outline h-[2.8rem] min-w-[6rem] py-0"
              >
                Again
              </button>
              <button
                type="button"
                onClick={() => handleGrade('hard')}
                className="btn-outline h-[2.8rem] min-w-[6rem] py-0"
              >
                Hard
              </button>
              <button
                type="button"
                onClick={() => handleGrade('good')}
                className="btn-outline h-[2.8rem] min-w-[6rem] py-0"
              >
                Good
              </button>
              <button
                type="button"
                onClick={() => handleGrade('easy')}
                className="btn-outline h-[2.8rem] min-w-[6rem] py-0"
              >
                Easy
              </button>
              <p className="ml-auto text-sm text-[#2f4f73]">
                {lastGrade ? `Last grade: ${lastGrade}` : 'Grade after reveal'}
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={moveToNextCard}
                className="btn-outline inline-flex h-[2.8rem] items-center gap-2 px-4 py-0"
              >
                <SkipForward className="h-4 w-4" />
                Next
              </button>
              <p className="text-sm text-[#2f4f73]">
                Random mode is separate from FSRS and does not affect scheduling.
              </p>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#2f4f73]">
          <Radio className="h-4 w-4" />
          <span>
            {isRevealed
              ? `Revealed after ${settings.revealDelaySeconds}s.`
              : `Waiting ${settings.revealDelaySeconds}s to reveal furigana + audio.`}
          </span>
          {playbackHint && <span className="text-[#9e4c2a]">{playbackHint}</span>}
          {settings.autoPlayAudio && (
            <span className="inline-flex items-center gap-1">
              <Play className="h-3.5 w-3.5" />
              Autoplay On
            </span>
          )}
        </div>
      </section>
    </div>
  );
};

export default JapaneseTimePracticeToolPage;
