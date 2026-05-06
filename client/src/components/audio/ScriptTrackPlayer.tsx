import { useEffect, useMemo, useState } from 'react';

import AudioPlayer from '../AudioPlayer';
import CurrentTextDisplay from '../CurrentTextDisplay';
import ViewToggleButtons from '../common/ViewToggleButtons';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import useWarmAudioCache from '../../hooks/useWarmAudioCache';
import type { DailyAudioPracticeTiming, LanguageCode, LessonScriptUnit } from '../../types';
import { findCurrentL2Unit, normalizeTimingDataForDuration } from './scriptTrackTiming';

interface ScriptTrackPlayerProps {
  title: string;
  status: string;
  audioUrl?: string | null;
  scriptUnits?: LessonScriptUnit[] | null;
  timingData?: DailyAudioPracticeTiming[] | null;
  targetLanguage: LanguageCode;
  approxDurationSeconds?: number | null;
}

function formatDuration(seconds?: number | null) {
  if (!seconds) return null;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function visibleTranscriptUnits(units: LessonScriptUnit[]) {
  return units.filter((unit) => unit.type === 'L2' || unit.type === 'narration_L1');
}

function formatLanguageLabel(language: LanguageCode) {
  return language === 'ja' ? 'Japanese' : language.toUpperCase();
}

function formatTrackStatus(status: string) {
  if (status === 'skipped') return 'Skipped during drill development.';
  if (status === 'draft' || status === 'generating') return 'Preparing audio...';
  if (status === 'error') return 'Track audio could not be generated.';
  return `Track audio is ${status}.`;
}

function formatTrackMeta(status: string, durationLabel: string | null) {
  if (durationLabel) return `${durationLabel} audio`;
  if (status === 'skipped') return 'Skipped';
  return status;
}

const ScriptTrackPlayer = ({
  title,
  status,
  audioUrl,
  scriptUnits,
  timingData,
  targetLanguage,
  approxDurationSeconds,
}: ScriptTrackPlayerProps) => {
  const { audioRef, currentTime, duration } = useAudioPlayer();
  const [showReadings, setShowReadings] = useState(false);
  const [showTranslations, setShowTranslations] = useState(false);
  const [currentUnit, setCurrentUnit] = useState<LessonScriptUnit | null>(null);
  const durationLabel = formatDuration(approxDurationSeconds);
  const ready = status === 'ready' && Boolean(audioUrl);
  const units = useMemo(() => scriptUnits ?? [], [scriptUnits]);
  const timings = useMemo(() => timingData ?? [], [timingData]);
  const scaledTimings = useMemo(
    () => normalizeTimingDataForDuration(timings, duration || approxDurationSeconds),
    [approxDurationSeconds, duration, timings]
  );

  useWarmAudioCache([audioUrl], ready);

  useEffect(() => {
    if (!ready || !units.length || !scaledTimings.length) {
      setCurrentUnit(null);
      return;
    }

    setCurrentUnit(findCurrentL2Unit(units, scaledTimings, currentTime));
  }, [currentTime, ready, scaledTimings, units]);

  return (
    <section className="retro-paper-panel border-2 border-[rgba(20,50,86,0.12)] bg-[rgba(252,246,228,0.92)] shadow-[0_8px_0_rgba(17,51,92,0.1)]">
      <div className="space-y-4 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="retro-headline text-3xl sm:text-[2.5rem]">{title}</h2>
            <p className="retro-caps text-[rgba(20,50,86,0.62)]">
              {formatTrackMeta(status, durationLabel)}
            </p>
          </div>
          {timings.length ? (
            <ViewToggleButtons
              showReadings={showReadings}
              showTranslations={showTranslations}
              onToggleReadings={() => setShowReadings((value) => !value)}
              onToggleTranslations={() => setShowTranslations((value) => !value)}
              readingsLabel="Furigana"
              className="justify-end gap-4"
            />
          ) : null}
        </div>

        {ready && audioUrl ? (
          <>
            {timings.length ? (
              <CurrentTextDisplay
                currentUnit={currentUnit}
                targetLanguage={targetLanguage}
                showReadings={showReadings}
                showTranslations={showTranslations}
              />
            ) : null}

            <div className="retro-paper-panel border-2 border-[rgba(20,50,86,0.12)] bg-[rgba(252,246,228,0.9)] px-4 py-3">
              <AudioPlayer src={audioUrl} audioRef={audioRef} key={audioUrl} />
            </div>
          </>
        ) : (
          <div className="border-2 border-[rgba(20,50,86,0.12)] bg-[rgba(20,141,189,0.12)] px-4 py-5 text-[rgba(20,50,86,0.72)]">
            {formatTrackStatus(status)}
          </div>
        )}

        {units.length ? (
          <details className="group">
            <summary className="cursor-pointer retro-caps text-[rgba(20,50,86,0.72)]">
              Transcript
            </summary>
            <div className="mt-3 grid gap-2">
              {visibleTranscriptUnits(units).map((unit, index) => (
                <div
                  // eslint-disable-next-line react/no-array-index-key -- Script units do not have stable IDs.
                  key={`${unit.type}-${index}`}
                  className="border-2 border-[rgba(20,50,86,0.08)] bg-white/55 px-3 py-2"
                >
                  <p className="text-sm uppercase tracking-[0.12em] text-[rgba(20,50,86,0.48)]">
                    {unit.type === 'L2' ? formatLanguageLabel(targetLanguage) : 'Narrator'}
                  </p>
                  <p className="text-lg font-semibold text-[rgba(20,50,86,0.9)]">{unit.text}</p>
                  {unit.type === 'L2' && unit.translation ? (
                    <p className="text-sm text-[rgba(20,50,86,0.62)]">{unit.translation}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
};

export default ScriptTrackPlayer;
