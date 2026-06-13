import type { DailyAudioPracticeTiming, LessonScriptUnit } from '../../types';

const TIMING_DRIFT_TOLERANCE_MS = 1000;
const SUBTITLE_LEAD_MS = 250;
const SUBTITLE_HOLD_MS = 1000;

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

  for (let index = timingData.length - 1; index >= 0; index -= 1) {
    const timing = timingData[index];
    const unit = units[timing.unitIndex];

    if (
      unit &&
      unit.type === 'L2' &&
      currentTimeMs >= timing.startTime - SUBTITLE_LEAD_MS &&
      currentTimeMs < timing.endTime + SUBTITLE_HOLD_MS
    ) {
      return unit;
    }
  }

  return null;
}

export function versionAudioUrl(audioUrl: string, updatedAt?: string | null): string {
  if (!updatedAt) return audioUrl;
  const separator = audioUrl.includes('?') ? '&' : '?';
  return `${audioUrl}${separator}v=${encodeURIComponent(updatedAt)}`;
}
