import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { SpeedValue } from '../common/SpeedSelector';
import { AudioScript, AudioScriptSegment, Episode, LessonScriptUnit } from '../../types';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import useWarmAudioCache from '../../hooks/useWarmAudioCache';
import AudioPlayer from '../AudioPlayer';
import CurrentTextDisplay from '../CurrentTextDisplay';
import JapaneseText from '../JapaneseText';
import SpeedSelector from '../common/SpeedSelector';
import ViewToggleButtons from '../common/ViewToggleButtons';
import { API_URL } from '../../config';
import { toAssetUrl } from '../study/studyCardUtils';
import {
  findCurrentL2Unit,
  normalizeTimingDataForDuration,
  versionAudioUrl,
} from './scriptTrackTiming';

const SCRIPT_SPEED_OPTIONS = [
  { value: '0.75x' as const, label: 'Slow', numericValue: 0.75 },
  { value: '0.85x' as const, label: 'Medium', numericValue: 0.85 },
  { value: '1.0x' as const, label: 'Normal', numericValue: 1.0 },
];

function speedValueToKey(speed: SpeedValue): string {
  if (speed === '0.75x' || speed === 0.75) return '0.75';
  if (speed === '0.85x' || speed === 'medium' || speed === 0.85) return '0.85';
  return '1.0';
}

function buildUnits(episode: Episode, speed: number): LessonScriptUnit[] {
  const script = episode.audioScript;
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
      units.push({ type: 'pause', seconds: 0.35 });
    }
  });

  return units;
}

function getSegmentImageUrl(segment: AudioScriptSegment | null): string | null {
  if (!segment) return null;
  const mediaId = segment.imageMedia?.id || segment.imageMediaId;
  return mediaId ? toAssetUrl(`/api/study/media/${mediaId}`) : null;
}

interface AudioScriptPlaybackProps {
  episode: Episode;
}

const AudioScriptPlayback = ({ episode }: AudioScriptPlaybackProps) => {
  const { audioRef, currentTime, duration, isPlaying, seek, play, pause } = useAudioPlayer();
  const [selectedSpeed, setSelectedSpeed] = useState<SpeedValue>('0.85x');
  const [showReadings, setShowReadings] = useState(false);
  const [showTranslations, setShowTranslations] = useState(true);
  const [scriptOverride, setScriptOverride] = useState<AudioScript | null>(null);
  const [isRetryingImages, setIsRetryingImages] = useState(false);
  const [imageRetryError, setImageRetryError] = useState<string | null>(null);
  const [cinemaDismissed, setCinemaDismissed] = useState(false);

  useEffect(() => {
    setScriptOverride(null);
    setImageRetryError(null);
    setIsRetryingImages(false);
    setCinemaDismissed(false);
  }, [episode.id]);

  useEffect(() => {
    if (!isPlaying) {
      setCinemaDismissed(false);
    }
  }, [isPlaying]);

  const script = scriptOverride ?? episode.audioScript;
  const readyRenders = useMemo(
    () => script?.renders.filter((render) => render.status === 'ready') ?? [],
    [script?.renders]
  );
  const warmedUrls = readyRenders
    .map((render) => render.audioUrl)
    .filter((url): url is string => Boolean(url));
  useWarmAudioCache(warmedUrls, warmedUrls.length > 0);

  const selectedRender = useMemo(() => {
    const speedKey = speedValueToKey(selectedSpeed);
    return readyRenders.find((render) => render.speed === speedKey) ?? readyRenders[0] ?? null;
  }, [readyRenders, selectedSpeed]);

  const units = useMemo(
    () =>
      buildUnits(
        {
          ...episode,
          audioScript: script,
        },
        selectedRender?.numericSpeed ?? 0.85
      ),
    [episode, script, selectedRender?.numericSpeed]
  );
  const timingData = useMemo(
    () =>
      normalizeTimingDataForDuration(
        selectedRender?.timingData ?? [],
        duration || selectedRender?.approxDurationSeconds
      ),
    [duration, selectedRender?.approxDurationSeconds, selectedRender?.timingData]
  );
  const currentUnit = findCurrentL2Unit(units, timingData, currentTime);

  const activeSegmentIndex = useMemo(() => {
    if (!currentUnit || currentUnit.type !== 'L2') return -1;
    return Math.floor(units.findIndex((unit) => unit === currentUnit) / 2);
  }, [currentUnit, units]);
  const activeSegment =
    activeSegmentIndex >= 0 ? (script?.segments[activeSegmentIndex] ?? null) : null;
  const activeImageUrl = getSegmentImageUrl(activeSegment);
  const canRetryImages = script?.imageStatus === 'partial' || script?.imageStatus === 'error';
  const showCinemaMode = Boolean(
    script && selectedRender?.audioUrl && isPlaying && !cinemaDismissed
  );

  useEffect(() => {
    if (!showCinemaMode) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showCinemaMode]);

  useEffect(() => {
    if (!showCinemaMode) return undefined;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCinemaDismissed(true);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [showCinemaMode]);

  const handleSeekToSegment = (segmentIndex: number) => {
    const unitIndex = segmentIndex * 2;
    const timing = timingData.find((entry) => entry.unitIndex === unitIndex);
    if (!timing) return;
    seek(timing.startTime / 1000);
    if (!isPlaying) {
      play();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, segmentIndex: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSeekToSegment(segmentIndex);
    }
  };

  const retryImages = async () => {
    setImageRetryError(null);
    setIsRetryingImages(true);

    try {
      const response = await fetch(`${API_URL}/api/scripts/${episode.id}/images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ force: false }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || payload?.message || 'Failed to retry images.');
      }

      const startedAt = Date.now();
      const timeoutMs = 5 * 60 * 1000;
      /* eslint-disable no-await-in-loop -- polling must wait between status requests */
      while (Date.now() - startedAt < timeoutMs) {
        const statusResponse = await fetch(`${API_URL}/api/scripts/${episode.id}/status`, {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!statusResponse.ok) {
          const payload = await statusResponse.json().catch(() => null);
          throw new Error(payload?.error || payload?.message || 'Failed to check image status.');
        }
        const nextScript = (await statusResponse.json()) as AudioScript;
        setScriptOverride(nextScript);
        if (
          nextScript.imageStatus === 'ready' ||
          nextScript.imageStatus === 'partial' ||
          nextScript.imageStatus === 'error'
        ) {
          return;
        }
        await new Promise((resolve) => {
          window.setTimeout(resolve, 2500);
        });
      }
      /* eslint-enable no-await-in-loop */
      throw new Error('Image retry timed out. Please try again later.');
    } catch (error) {
      setImageRetryError(error instanceof Error ? error.message : 'Failed to retry images.');
    } finally {
      setIsRetryingImages(false);
    }
  };

  if (!script) {
    return (
      <div className="w-full max-w-5xl mx-auto">
        <div className="retro-paper-panel p-8 text-center">
          <p className="text-navy">Script not found.</p>
          <Link to="/app/library" className="btn-primary mt-4 inline-flex">
            Back to Library
          </Link>
        </div>
      </div>
    );
  }

  const audioUrl = selectedRender?.audioUrl
    ? versionAudioUrl(selectedRender.audioUrl, selectedRender.updatedAt?.toString())
    : null;

  return (
    <div
      className="retro-playback-v3-page w-full max-w-7xl xl:max-w-[96rem] mx-auto space-y-4"
      data-testid="script-playback-page"
    >
      <div className="sticky top-[4.5rem] z-10 bg-[rgba(251,245,224,0.98)] mb-3">
        <div className="retro-paper-panel border-2 border-[rgba(20,50,86,0.12)] bg-[rgba(20,141,189,0.22)] shadow-[0_8px_0_rgba(17,51,92,0.1)] px-4 sm:px-5 py-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
            <div className="flex-1">
              <h1 className="retro-headline text-3xl sm:text-6xl mb-2">{episode.title}</h1>
              <div className="inline-flex items-center gap-3 retro-caps text-[rgba(20,50,86,0.92)] text-base sm:text-xl">
                <div className="px-3 py-2 bg-[rgba(20,50,86,0.18)] font-semibold">Script</div>
                <div className="px-3 py-2 bg-[rgba(20,50,86,0.18)] font-semibold">
                  {script.segments.length} lines
                </div>
              </div>
            </div>

            {audioUrl && (
              <div className="flex flex-col items-start sm:items-end gap-2 sm:ml-6">
                <ViewToggleButtons
                  showReadings={showReadings}
                  showTranslations={showTranslations}
                  onToggleReadings={() => setShowReadings(!showReadings)}
                  onToggleTranslations={() => setShowTranslations(!showTranslations)}
                  readingsLabel="Furigana"
                />
                <SpeedSelector
                  selectedSpeed={selectedSpeed}
                  onSpeedChange={setSelectedSpeed}
                  options={SCRIPT_SPEED_OPTIONS}
                  showLabels
                />
              </div>
            )}
          </div>
        </div>

        {audioUrl ? (
          <div className="retro-paper-panel border-x-2 border-b-2 border-[rgba(20,50,86,0.12)] px-4 py-3">
            <AudioPlayer
              src={audioUrl}
              audioRef={audioRef}
              onEnded={() => {
                pause();
                seek(0);
              }}
            />
          </div>
        ) : (
          <div className="retro-paper-panel bg-yellow border-x-2 border-b-2 border-[rgba(20,50,86,0.12)] p-4">
            <p className="text-sm font-medium text-dark-brown">
              {script.status === 'error'
                ? script.errorMessage || 'Script audio generation failed.'
                : 'Script audio is not ready yet.'}
            </p>
          </div>
        )}
      </div>

      {showCinemaMode && (
        <div
          className="fixed inset-0 z-[1000] flex flex-col bg-[#061522] text-white"
          data-testid="script-cinema-overlay"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/15 bg-black/30 px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <div className="retro-caps text-xs text-white/60">Script</div>
              <div className="truncate text-lg font-semibold">{episode.title}</div>
            </div>
            <button
              type="button"
              onClick={() => setCinemaDismissed(true)}
              className="rounded border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60"
            >
              Exit
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col bg-black">
            <div className="flex min-h-0 flex-1 items-center justify-center p-2 sm:p-4">
              {activeImageUrl ? (
                <img
                  src={activeImageUrl}
                  alt={activeSegment?.translation || 'Script scene illustration'}
                  className="max-h-full max-w-full object-contain"
                  data-testid="script-cinema-image"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-4 text-center retro-caps text-white/45">
                  Illustration pending
                </div>
              )}
            </div>
            <div
              className="shrink-0 border-t border-white/15 bg-[#061522] px-4 py-4 text-center shadow-[0_-12px_36px_rgba(0,0,0,0.35)] sm:px-10 sm:py-5"
              data-testid="script-cinema-caption"
            >
              {currentUnit?.type === 'L2' && (
                <div className="mx-auto max-h-[34vh] max-w-5xl overflow-y-auto px-1">
                  <div className="text-2xl font-semibold leading-relaxed text-white sm:text-4xl">
                    <JapaneseText
                      text={currentUnit.reading || currentUnit.text}
                      showFurigana={showReadings}
                      metadata={activeSegment?.metadata}
                    />
                  </div>
                  {showTranslations && currentUnit.translation && (
                    <div className="mx-auto mt-2 max-w-4xl text-base font-medium leading-snug text-[rgba(255,255,255,0.86)] sm:text-xl">
                      {currentUnit.translation}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        className="retro-paper-panel overflow-hidden border-2 border-[rgba(20,50,86,0.12)] bg-[rgba(252,246,228,0.92)]"
        data-testid="script-active-image-panel"
      >
        <div className="flex aspect-[16/9] w-full items-center justify-center bg-[rgba(20,50,86,0.08)]">
          {activeImageUrl ? (
            <img
              src={activeImageUrl}
              alt={activeSegment?.translation || 'Script scene illustration'}
              className="h-full w-full object-contain"
              data-testid="script-active-image"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center retro-caps text-[rgba(20,50,86,0.48)]">
              Illustration pending
            </div>
          )}
        </div>
        {(canRetryImages || imageRetryError) && (
          <div className="flex flex-col gap-2 border-t-2 border-[rgba(20,50,86,0.08)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-[rgba(20,50,86,0.72)]">
              {imageRetryError || script?.imageErrorMessage || 'Some illustrations are missing.'}
            </p>
            {canRetryImages && (
              <button
                type="button"
                onClick={retryImages}
                disabled={isRetryingImages}
                className="btn-secondary inline-flex justify-center"
                data-testid="script-button-retry-images"
              >
                {isRetryingImages ? 'Retrying...' : 'Retry images'}
              </button>
            )}
          </div>
        )}
      </div>

      <CurrentTextDisplay
        currentUnit={currentUnit}
        targetLanguage="ja"
        showReadings={showReadings}
        showTranslations={showTranslations}
      />

      <div className="space-y-3">
        {script.segments.map((segment, index) => (
          <button
            key={segment.id}
            type="button"
            onClick={() => handleSeekToSegment(index)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`retro-paper-panel w-full text-left p-4 transition ${
              Math.floor(activeSegmentIndex) === index
                ? 'bg-[rgba(247,199,68,0.35)]'
                : 'bg-[rgba(255,255,255,0.55)]'
            }`}
            data-testid="script-segment-row"
          >
            <div className="retro-caps text-sm text-[rgba(20,50,86,0.58)] mb-2">
              Segment {index + 1}
            </div>
            <div className="text-2xl text-navy leading-relaxed">
              <JapaneseText
                text={segment.reading || segment.text}
                showFurigana={showReadings}
                metadata={segment.metadata}
              />
            </div>
            {showTranslations && (
              <div className="mt-2 text-base text-[rgba(20,50,86,0.72)]">{segment.translation}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default AudioScriptPlayback;
