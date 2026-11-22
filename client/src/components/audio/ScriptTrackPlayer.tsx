import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, memo, useMemo, useState, useRef } from 'react';
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
}) => {
  const { t } = useTranslation('study', { keyPrefix: 'drillPlayer' });
  return (
    <div className="drill-transport">
      <button type="button" className="drill-primary" onClick={toggle}>
        {audio.isPlaying ? (
          <>
            <Pause size={15} /> {t('pause')}
          </>
        ) : (
          <>
            <Play size={15} /> {t('play')}
          </>
        )}
      </button>
      <div className="drill-timeline">
        <input
          type="range"
          aria-label={t('seek')}
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
};
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
type ScriptTextProps = Pick<TranscriptProps, 'scriptUnits' | 'targetLanguage'>;
const FullTranscript = memo(({ scriptUnits, targetLanguage }: ScriptTextProps) => (
  // Unit order is fixed for the lifetime of a recording revision.
  <div className="drill-script">
    {scriptUnits?.map((line, index) => {
      if (line.type !== 'L2' && line.type !== 'narration_L1') return null;
      return (
        // eslint-disable-next-line react/no-array-index-key -- Script units have no IDs and stay in recording order.
        <p key={index} lang={line.type === 'L2' ? targetLanguage : undefined}>
          {line.text}
        </p>
      );
    })}
  </div>
));
FullTranscript.displayName = 'FullTranscript';

const CurrentLine = ({
  unit,
  targetLanguage,
}: {
  unit: Extract<LessonScriptUnit, { type: 'L2' }>;
  targetLanguage: LanguageCode;
}) => {
  const { t } = useTranslation('study', { keyPrefix: 'drillPlayer' });
  const [readings, setReadings] = useState(false);
  const [translations, setTranslations] = useState(false);
  return (
    <>
      <div lang={targetLanguage}>
        {readings && unit.reading ? <StudyRubyText text={unit.reading} /> : unit.text}
      </div>
      {unit.reading && (
        <button type="button" aria-pressed={readings} onClick={() => setReadings(!readings)}>
          {t('furigana')}
        </button>
      )}
      {unit.translation && (
        <button
          type="button"
          aria-pressed={translations}
          onClick={() => setTranslations(!translations)}
        >
          {t('translation')}
        </button>
      )}
      {translations && <p>{unit.translation}</p>}
    </>
  );
};

const Transcript = ({
  scriptUnits,
  timingData,
  targetLanguage,
  total,
  currentTime,
}: TranscriptProps) => {
  const { t } = useTranslation('study', { keyPrefix: 'drillPlayer' });
  const unit = useTranscriptUnit({ scriptUnits, timingData, total, currentTime });
  if (!scriptUnits?.length) return <p>{t('noTranscript')}</p>;
  const script = <FullTranscript scriptUnits={scriptUnits} targetLanguage={targetLanguage} />;
  if (!timingData?.length) return script;
  return (
    <div className="drill-transcript">
      {unit?.type === 'L2' ? (
        <CurrentLine unit={unit} targetLanguage={targetLanguage} />
      ) : (
        <p>{t('listening')}</p>
      )}
      <details>
        <summary>{t('fullScript')}</summary>
        {script}
      </details>
    </div>
  );
};
const TranscriptDisclosure = (props: TranscriptProps) => {
  const { t } = useTranslation('study', { keyPrefix: 'drillPlayer' });
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
            {t('hideText')} <span aria-hidden="true">⌃</span>
          </>
        ) : (
          <>
            {t('showText')} <span aria-hidden="true">⌄</span>
          </>
        )}
      </button>
      {show && <Transcript {...props} />}
    </>
  );
};
const ScriptTrackPlayer = (props: ScriptTrackPlayerProps) => {
  const { t } = useTranslation('study', { keyPrefix: 'drillPlayer' });
  const { title, approxDurationSeconds, status, audioUrl, updatedAt } = props;
  const { audio, attach, failed, setFailed, toggle } = useDrillPlayback();
  const complete = useDrillActivity(title, audio.isPlaying);
  const total = audio.duration || approxDurationSeconds || 0;
  if (status !== 'ready' || !audioUrl) return <p>{t('unavailable')}</p>;
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
      {failed && <p role="alert">{t('playError')}</p>}
      <TranscriptDisclosure {...props} total={total} currentTime={audio.currentTime} />
    </>
  );
};
export default ScriptTrackPlayer;
