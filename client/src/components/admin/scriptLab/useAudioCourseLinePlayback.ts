import { useCallback, useMemo, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { adminApi } from '../../../lib/adminApi';
import type { LessonScriptUnit } from '../../../types';

const PLAYABLE_UNIT_TYPES = new Set(['narration_L1', 'L2']);
type PlayableLessonScriptUnit = Extract<LessonScriptUnit, { type: 'narration_L1' | 'L2' }>;

interface SynthesisPayload {
  text: string;
  voiceId: string;
  speed?: number;
}

const isPlayableUnit = (unit: LessonScriptUnit): unit is PlayableLessonScriptUnit =>
  PLAYABLE_UNIT_TYPES.has(unit.type);

const synthesisPayloadFor = (unit: PlayableLessonScriptUnit): SynthesisPayload => ({
  text: unit.type === 'L2' ? unit.reading || unit.text : unit.text,
  voiceId: unit.voiceId,
  speed: unit.type === 'L2' ? unit.speed : undefined,
});

const requestLineAudio = async (unit: PlayableLessonScriptUnit): Promise<string> => {
  const response = await fetch(adminApi.scriptLabSynthesizeLine, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(synthesisPayloadFor(unit)),
  });

  if (!response.ok) {
    const data = (await response.json()) as { message?: string };
    throw new Error(data.message || 'Failed to synthesize line');
  }

  const data = (await response.json()) as { audioUrl: string };
  return data.audioUrl;
};

interface PlaybackContext {
  audioCache: Record<number, string>;
  audioRef: MutableRefObject<HTMLAudioElement | null>;
  playingIndex: number | null;
  reportError: (message: string) => void;
  setAudioCache: Dispatch<SetStateAction<Record<number, string>>>;
  setLineLoadingIndex: Dispatch<SetStateAction<number | null>>;
  setPlayingIndex: Dispatch<SetStateAction<number | null>>;
  setPlayingUrl: Dispatch<SetStateAction<string | null>>;
}

const stopCurrentLine = (context: PlaybackContext, index: number): boolean => {
  const activeAudio = context.audioRef.current;
  const shouldStop = [context.playingIndex === index, activeAudio?.paused === false].every(Boolean);
  if (!shouldStop) {
    return false;
  }

  activeAudio?.pause();
  context.setPlayingIndex(null);
  return true;
};

const playCachedLine = (context: PlaybackContext, index: number): boolean => {
  const cachedUrl = context.audioCache[index];
  if (!cachedUrl) {
    return false;
  }

  context.setPlayingUrl(cachedUrl);
  context.setPlayingIndex(index);
  return true;
};

const usePlayLine = (context: PlaybackContext) => {
  const playLine = useCallback(
    async (unit: LessonScriptUnit, index: number) => {
      if (!isPlayableUnit(unit)) {
        return;
      }
      if (stopCurrentLine(context, index)) {
        return;
      }
      if (playCachedLine(context, index)) {
        return;
      }

      context.setLineLoadingIndex(index);
      context.reportError('');

      try {
        const audioUrl = await requestLineAudio(unit);
        context.setAudioCache((previous) => ({ ...previous, [index]: audioUrl }));
        context.setPlayingUrl(audioUrl);
        context.setPlayingIndex(index);
      } catch (error) {
        context.reportError(error instanceof Error ? error.message : 'Failed to synthesize line');
      } finally {
        context.setLineLoadingIndex(null);
      }
    },
    [context]
  );

  return playLine;
};

const useAudioCourseLinePlayback = (reportError: (message: string) => void) => {
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [lineLoadingIndex, setLineLoadingIndex] = useState<number | null>(null);
  const [audioCache, setAudioCache] = useState<Record<number, string>>({});
  const audioRef = useRef<HTMLAudioElement>(null);
  const playbackContext = useMemo(
    () => ({
      audioCache,
      audioRef,
      playingIndex,
      reportError,
      setAudioCache,
      setLineLoadingIndex,
      setPlayingIndex,
      setPlayingUrl,
    }),
    [audioCache, playingIndex, reportError]
  );
  const playLine = usePlayLine(playbackContext);

  const resetPlayback = useCallback(() => {
    setAudioCache({});
    setPlayingIndex(null);
    setPlayingUrl(null);
  }, []);

  const finishPlayback = useCallback(() => {
    setPlayingIndex(null);
    setPlayingUrl(null);
  }, []);

  return {
    audioRef,
    finishPlayback,
    lineLoadingIndex,
    playLine,
    playingIndex,
    playingUrl,
    resetPlayback,
  };
};

export default useAudioCourseLinePlayback;
