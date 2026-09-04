import { useMemo } from 'react';
import { AUDIO_SCRIPT_SEGMENT_PAUSE_SECONDS } from '@languageflow/shared/src/audioScript';

import type { SpeedValue } from '../common/SpeedSelector';
import type { AudioScript, AudioScriptRender, Episode, LessonScriptUnit } from '../../types';
import useWarmAudioCache from '../../hooks/useWarmAudioCache';
import { findCurrentL2Unit, normalizeTimingDataForDuration } from './scriptTrackTiming';
import {
  getSegmentImageUrl,
  resolveScriptAudioUrl,
  resolveScriptAudioUrls,
} from './scriptPlaybackRoutes';

const SCRIPT_SPEED_KEYS = new Map<SpeedValue, string>([
  ['0.75x', '0.75'],
  [0.75, '0.75'],
  ['0.85x', '0.85'],
  ['medium', '0.85'],
  [0.85, '0.85'],
  ['1.0x', '1.0'],
  ['normal', '1.0'],
  [1.0, '1.0'],
]);

function speedValueToKey(speed: SpeedValue) {
  const speedKey = SCRIPT_SPEED_KEYS.get(speed);
  if (speedKey) return speedKey;
  throw new Error(`Unsupported script playback speed: ${String(speed)}`);
}

function readyScriptRenders(script: AudioScript | null | undefined) {
  return script?.renders.filter((render) => render.status === 'ready') ?? [];
}

function selectRender(readyRenders: AudioScriptRender[], selectedSpeed: SpeedValue) {
  const speedKey = speedValueToKey(selectedSpeed);
  return readyRenders.find((render) => render.speed === speedKey) ?? readyRenders[0] ?? null;
}

function buildUnits(script: AudioScript | null | undefined, speed: number): LessonScriptUnit[] {
  if (!script) return [];

  const units: LessonScriptUnit[] = [];
  script.segments.forEach((segment, index) => {
    units.push({
      type: 'L2',
      text: segment.text,
      reading: segment.reading || undefined,
      translation: segment.translation,
      voiceId: script.voiceId,
      speed,
    });
    if (index < script.segments.length - 1) {
      units.push({ type: 'pause', seconds: AUDIO_SCRIPT_SEGMENT_PAUSE_SECONDS });
    }
  });
  return units;
}

function findActiveSegmentIndex(units: LessonScriptUnit[], currentUnit: LessonScriptUnit | null) {
  if (!currentUnit || currentUnit.type !== 'L2') return -1;
  return Math.floor(units.findIndex((unit) => unit === currentUnit) / 2);
}

function selectActiveSegment(script: AudioScript | null | undefined, index: number) {
  if (!script || index < 0) return null;
  return script.segments[index] ?? null;
}

function imagesCanBeRetried(script: AudioScript | null | undefined) {
  return ['partial', 'error'].includes(script?.imageStatus ?? '');
}

function chooseScript(scriptOverride: AudioScript | null, episode: Episode) {
  return scriptOverride ?? episode.audioScript;
}

function renderSpeed(render: AudioScriptRender | null) {
  return render?.numericSpeed ?? 0.85;
}

function normalizedTiming(render: AudioScriptRender | null, duration: number) {
  return normalizeTimingDataForDuration(
    render?.timingData ?? [],
    duration || render?.approxDurationSeconds
  );
}

function selectDisplaySegment(
  script: AudioScript | null | undefined,
  activeSegment: AudioScript['segments'][number] | null
) {
  return activeSegment ?? script?.segments[0] ?? null;
}

interface PlaybackModelOptions {
  currentTime: number;
  duration: number;
  episode: Episode;
  scriptOverride: AudioScript | null;
  selectedSpeed: SpeedValue;
}

export default function useAudioScriptPlaybackModel({
  currentTime,
  duration,
  episode,
  scriptOverride,
  selectedSpeed,
}: PlaybackModelOptions) {
  const script = chooseScript(scriptOverride, episode);
  const readyRenders = useMemo(() => readyScriptRenders(script), [script]);
  const warmedUrls = resolveScriptAudioUrls(episode.id, readyRenders);
  useWarmAudioCache(warmedUrls, Boolean(warmedUrls.length));

  const selectedRender = useMemo(
    () => selectRender(readyRenders, selectedSpeed),
    [readyRenders, selectedSpeed]
  );
  const selectedAudioUrl = resolveScriptAudioUrl(episode.id, selectedRender);
  const units = useMemo(
    () => buildUnits(script, renderSpeed(selectedRender)),
    [script, selectedRender]
  );
  const timingData = useMemo(
    () => normalizedTiming(selectedRender, duration),
    [duration, selectedRender]
  );
  const currentUnit = findCurrentL2Unit(units, timingData, currentTime);
  const activeSegmentIndex = useMemo(
    () => findActiveSegmentIndex(units, currentUnit),
    [currentUnit, units]
  );
  const activeSegment = selectActiveSegment(script, activeSegmentIndex);
  const displaySegment = selectDisplaySegment(script, activeSegment);

  return {
    activeImageUrl: getSegmentImageUrl(displaySegment),
    activeSegment,
    activeSegmentIndex,
    canRetryImages: imagesCanBeRetried(script),
    currentUnit,
    displaySegment,
    script,
    selectedAudioUrl,
    selectedRender,
    timingData,
  };
}
