import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Play, Pause } from 'lucide-react';
import type { DailyAudioPracticeTiming, LanguageCode, LessonScriptUnit } from '../../types';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { useStudyActivityActions } from '../../contexts/StudyActivityContext';
import {
  findCurrentL2Unit,
  normalizeTimingDataForDuration,
  versionAudioUrl,
} from './scriptTrackTiming';
import StudyRubyText from '../study/StudyRubyText';

interface ScriptTrackPlayerProps {
  title: string;
  status: string;
  audioUrl?: string | null;
  scriptUnits?: LessonScriptUnit[] | null;
  timingData?: DailyAudioPracticeTiming[] | null;
  targetLanguage: LanguageCode;
  approxDurationSeconds?: number | null;
  updatedAt?: string | null;
}

const DAILY_AUDIO_COMPLETION_PREFIX = 'Daily Audio completed: ';
const STUDY_ACTIVITY_NAME_MAX_LENGTH = 120;

function boundedActivityName(name: string) {
  return Array.from(name).slice(0, STUDY_ACTIVITY_NAME_MAX_LENGTH).join('');
}

function useDrillActivity(title: string, isPlaying: boolean) {
  const {
    start: startActivity,
    stop: stopActivity,
    stopAndWait: stopActivityAndWait,
    logCompletedAndWait,
  } = useStudyActivityActions();
  const activityName = boundedActivityName(title);
  useEffect(() => {
    if (!isPlaying) return undefined;
    startActivity({
      activity: 'daily_audio',
      source: 'automatic',
      name: activityName,
    });
    return () => stopActivity('daily_audio', activityName);
  }, [activityName, isPlaying, startActivity, stopActivity]);

  const recordCompletion = useCallback(() => {
    stopActivityAndWait('daily_audio', activityName)
      .then(() => {
        const now = new Date().toISOString();
        return logCompletedAndWait({
          clientSessionId: crypto.randomUUID(),
          activity: 'daily_audio',
          source: 'automatic',
          name: boundedActivityName(`${DAILY_AUDIO_COMPLETION_PREFIX}${title}`),
          startedAt: now,
          endedAt: now,
          durationMs: 0,
          audioPlaybackMs: 0,
        });
      })
      .catch(() => undefined);
  }, [activityName, logCompletedAndWait, stopActivityAndWait, title]);

  return recordCompletion;
}
function clock(seconds: number) {
  const t = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}
function useDrillPlayback() {
  const audio = useAudioPlayer();
  const ref = audio.audioRef;
  const media = useRef<HTMLAudioElement | null>(null);
  const attach = useCallback(
    (node: HTMLAudioElement | null) => {
      media.current = node;
      ref(node);
    },
    [ref]
  );
  const [failed, setFailed] = useState(false);
  const toggle = () => {
    const node = media.current;
    if (!node) return;
    if (audio.isPlaying) {
      node.pause();
      return;
    }
    if (failed) node.load();
    setFailed(false);
    node.play().catch(() => setFailed(true));
  };
  return { audio, attach, failed, setFailed, toggle };
}
const Transport = ({
  audio,
  total,
  toggle,
}: {
  audio: ReturnType<typeof useAudioPlayer>;
  total: number;
  toggle: () => void;
}) => (
  <div className="drill-transport">
    <button type="button" className="drill-primary" onClick={toggle}>
      {audio.isPlaying ? (
        <>
          <Pause size={15} /> Pause
        </>
      ) : (
        <>
          <Play size={15} /> Play
        </>
      )}
    </button>
    <div className="drill-timeline">
      <input
        type="range"
        aria-label="Seek in drill"
        min={0}
        max={total || 1}
        step={0.1}
        disabled={!audio.duration}
        value={Math.min(audio.currentTime, total)}
        onChange={(e) => audio.seek(Number(e.target.value))}
      />
      <div>
        <span>{clock(audio.currentTime)}</span>
        <span>{clock(total)}</span>
      </div>
    </div>
  </div>
);
type TranscriptProps = Pick<
  ScriptTrackPlayerProps,
  'scriptUnits' | 'timingData' | 'targetLanguage'
> & { total: number; currentTime: number };
function useTranscriptUnit({
  scriptUnits,
  timingData,
  total,
  currentTime,
}: Omit<TranscriptProps, 'targetLanguage'>) {
  const timings = useMemo(
    () => normalizeTimingDataForDuration(timingData ?? [], total),
    [timingData, total]
  );
  return (
    findCurrentL2Unit(scriptUnits ?? [], timings, currentTime) ??
    (currentTime === 0 ? scriptUnits?.find((u) => u.type === 'L2') : null)
  );
}
const Transcript = ({
  scriptUnits,
  timingData,
  targetLanguage,
  total,
  currentTime,
}: TranscriptProps) => {
  const [readings, setReadings] = useState(false);
  const unit = useTranscriptUnit({ scriptUnits, timingData, total, currentTime });
  return (
    <div className="drill-transcript">
      {unit?.type === 'L2' ? (
        <>
          <div lang={targetLanguage}>
            {readings && unit.reading ? <StudyRubyText text={unit.reading} /> : unit.text}
          </div>
          {unit.translation && <p>{unit.translation}</p>}
          {unit.reading && (
            <button type="button" aria-pressed={readings} onClick={() => setReadings(!readings)}>
              Furigana
            </button>
          )}
        </>
      ) : (
        <p>{scriptUnits?.length ? 'Listening…' : 'No transcript available.'}</p>
      )}
    </div>
  );
};
const TranscriptDisclosure = (props: TranscriptProps) => {
  const [show, setShow] = useState(false);
  return (
    <>
      <button
        type="button"
        className="drill-disclose"
        aria-expanded={show}
        onClick={() => setShow(!show)}
      >
        {show ? (
          <>
            Hide text <span aria-hidden="true">⌃</span>
          </>
        ) : (
          <>
            Show text <span aria-hidden="true">⌄</span>
          </>
        )}
      </button>
      {show && <Transcript {...props} />}
    </>
  );
};
const ScriptTrackPlayer = (props: ScriptTrackPlayerProps) => {
  const { title, approxDurationSeconds, status, audioUrl, updatedAt } = props;
  const { audio, attach, failed, setFailed, toggle } = useDrillPlayback();
  const complete = useDrillActivity(title, audio.isPlaying);
  const total = audio.duration || approxDurationSeconds || 0;
  if (status !== 'ready' || !audioUrl) return <p>Audio unavailable.</p>;
  return (
    <>
      <audio
        ref={attach}
        src={versionAudioUrl(audioUrl, updatedAt)}
        preload="metadata"
        onEnded={complete}
        onError={() => setFailed(true)}
      />
      <Transport audio={audio} total={total} toggle={toggle} />
      {failed && <p role="alert">Audio could not play. Press Play to retry.</p>}
      <TranscriptDisclosure {...props} total={total} currentTime={audio.currentTime} />
    </>
  );
};
export default ScriptTrackPlayer;
