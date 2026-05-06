import type { DailyAudioPracticeTiming, LessonScriptUnit } from '../../types';

const TIMING_DRIFT_TOLERANCE_MS = 1000;

export function normalizeTimingDataForDuration(
  timingData: DailyAudioPracticeTiming[],
  durationSeconds?: number | null
) {
  if (!durationSeconds || durationSeconds <= 0 || timingData.length === 0) return timingData;

  const finalTimingEnd = Math.max(...timingData.map((timing) => timing.endTime));
  const targetEnd = Math.round(durationSeconds * 1000);
  if (finalTimingEnd <= 0 || targetEnd <= 0) return timingData;
  if (Math.abs(finalTimingEnd - targetEnd) <= TIMING_DRIFT_TOLERANCE_MS) return timingData;

  const scale = targetEnd / finalTimingEnd;
  return timingData.map((timing) => ({
    ...timing,
    startTime: Math.round(timing.startTime * scale),
    endTime: Math.round(timing.endTime * scale),
  }));
}

export function findCurrentL2Unit(
  units: LessonScriptUnit[],
  timingData: DailyAudioPracticeTiming[],
  currentTimeSeconds: number
) {
  const currentTimeMs = currentTimeSeconds * 1000;
  const activeTiming = timingData.find((timing) => {
    const unit = units[timing.unitIndex];
    return (
      unit &&
      unit.type === 'L2' &&
      currentTimeMs >= timing.startTime - 1000 &&
      currentTimeMs < timing.endTime + 1000
    );
  });

  return activeTiming ? units[activeTiming.unitIndex] : null;
}
