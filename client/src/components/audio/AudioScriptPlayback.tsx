import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AUDIO_SCRIPT_SEGMENT_PAUSE_SECONDS } from '@languageflow/shared/src/audioScript';
import type { SpeedValue } from '../common/SpeedSelector';
import { AudioScript, AudioScriptSegment, Episode, LessonScriptUnit } from '../../types';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import useWarmAudioCache from '../../hooks/useWarmAudioCache';
import AudioPlayer from '../AudioPlayer';
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
  if (speed === '1.0x' || speed === 'normal' || speed === 1.0) return '1.0';
  throw new Error(`Unsupported script playback speed: ${String(speed)}`);
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
      units.push({ type: 'pause', seconds: AUDIO_SCRIPT_SEGMENT_PAUSE_SECONDS });
    }
  });

  return units;
}

function getSegmentImageUrl(segment: AudioScriptSegment | null): string | null {
  if (!segment) return null;
  const mediaId = segment.imageMedia?.id || segment.imageMediaId;
  return mediaId ? toAssetUrl(`/api/study/media/${mediaId}`) : null;
}

function shouldIgnorePlaybackShortcut(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    tagName === 'button'
  );
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
  const [cinemaOpen, setCinemaOpen] = useState(false);
  const [stickyHeaderHeight, setStickyHeaderHeight] = useState(0);
  const [stickyImageHeight, setStickyImageHeight] = useState(0);
  const stickyHeaderRef = useRef<HTMLDivElement | null>(null);
  const stickyImageRef = useRef<HTMLDivElement | null>(null);
  const segmentRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    setScriptOverride(null);
    setImageRetryError(null);
    setIsRetryingImages(false);
    setCinemaOpen(false);
  }, [episode.id]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
  const audioUrl = selectedRender?.audioUrl
    ? versionAudioUrl(selectedRender.audioUrl, selectedRender.updatedAt?.toString())
    : null;

  useEffect(() => {
    if (!audioUrl) return undefined;

    const handlePlaybackShortcut = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (shouldIgnorePlaybackShortcut(event.target)) {
        return;
      }

      event.preventDefault();
      if (isPlaying) {
        pause();
      } else {
        play();
      }
    };

    window.addEventListener('keydown', handlePlaybackShortcut);
    return () => {
      window.removeEventListener('keydown', handlePlaybackShortcut);
    };
  }, [audioUrl, isPlaying, pause, play]);

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
  const displaySegment = activeSegment ?? script?.segments[0] ?? null;
  const activeImageUrl = getSegmentImageUrl(displaySegment);
  const canRetryImages = script?.imageStatus === 'partial' || script?.imageStatus === 'error';
  const showCinemaMode = Boolean(script && selectedRender?.audioUrl && cinemaOpen);
  const readerImageTop = `calc(4.5rem + ${stickyHeaderHeight}px + 0.5rem)`;
  const readerLineScrollMarginTop = `calc(4.5rem + ${
    stickyHeaderHeight + stickyImageHeight
  }px + 1.5rem)`;

  useEffect(() => {
    const updateStickyMeasurements = () => {
      setStickyHeaderHeight(stickyHeaderRef.current?.getBoundingClientRect().height ?? 0);
      setStickyImageHeight(stickyImageRef.current?.getBoundingClientRect().height ?? 0);
    };

    updateStickyMeasurements();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateStickyMeasurements);
      return () => {
        window.removeEventListener('resize', updateStickyMeasurements);
      };
    }

    const observer = new ResizeObserver(updateStickyMeasurements);
    if (stickyHeaderRef.current) observer.observe(stickyHeaderRef.current);
    if (stickyImageRef.current) observer.observe(stickyImageRef.current);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!showCinemaMode) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showCinemaMode]);

  useEffect(() => {
    if (activeSegmentIndex < 0 || showCinemaMode) return;
    const row = segmentRefs.current[activeSegmentIndex];
    if (typeof row?.scrollIntoView !== 'function') return;
    row.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, [activeSegmentIndex, showCinemaMode]);

  useEffect(() => {
    if (!showCinemaMode) return undefined;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCinemaOpen(false);
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

  const openCinemaMode = () => {
    setCinemaOpen(true);
    if (!isPlaying) {
      play();
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
      if (!mountedRef.current) return;

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
        if (!mountedRef.current) return;
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
      if (mountedRef.current) {
        setImageRetryError(error instanceof Error ? error.message : 'Failed to retry images.');
      }
    } finally {
      if (mountedRef.current) {
        setIsRetryingImages(false);
      }
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

  return (
    <div
      className="retro-playback-v3-page w-full max-w-7xl xl:max-w-[96rem] mx-auto space-y-3"
      data-testid="script-playback-page"
    >
      <div
        ref={stickyHeaderRef}
        className="sticky top-[4.5rem] z-10 mb-3 bg-[rgba(251,245,224,0.98)]"
      >
        <div className="retro-paper-panel border-2 border-[rgba(20,50,86,0.12)] bg-[rgba(20,141,189,0.18)] shadow-[0_6px_0_rgba(17,51,92,0.08)] px-4 py-2.5 sm:px-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="retro-headline text-3xl sm:text-5xl">{episode.title}</h1>
              {audioUrl ? (
                <div className="mt-1.5 max-w-4xl">
                  <AudioPlayer
                    src={audioUrl}
                    audioRef={audioRef}
                    variant="compact"
                    onEnded={() => {
                      pause();
                      seek(0);
                    }}
                  />
                </div>
              ) : (
                <div className="mt-2 bg-yellow p-3 text-sm font-medium text-dark-brown">
                  {script.status === 'error'
                    ? script.errorMessage || 'Script audio generation failed.'
                    : 'Script audio is not ready yet.'}
                </div>
              )}
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
                <button
                  type="button"
                  onClick={openCinemaMode}
                  className="btn-secondary inline-flex justify-center"
                  data-testid="script-button-movie-mode"
                >
                  Movie mode
                </button>
              </div>
            )}
          </div>
        </div>
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
              onClick={() => setCinemaOpen(false)}
              className="rounded border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60"
            >
              Exit
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black p-2 sm:p-4">
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
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3 sm:bottom-6 sm:px-8">
              {currentUnit?.type === 'L2' && (
                <div
                  className="pointer-events-auto max-h-[34vh] w-fit max-w-[min(92vw,64rem)] overflow-y-auto rounded-md border border-white/20 bg-[rgba(4,16,28,0.68)] px-3 py-2 text-center shadow-[0_18px_52px_rgba(0,0,0,0.52)] backdrop-blur-md sm:px-5 sm:py-3"
                  data-testid="script-cinema-caption"
                >
                  <div
                    className="text-2xl font-semibold leading-relaxed text-[#fff3b0] sm:text-4xl"
                    style={{ textShadow: '0 2px 10px rgba(0, 0, 0, 0.8)' }}
                  >
                    <JapaneseText
                      text={currentUnit.reading || currentUnit.text}
                      showFurigana={showReadings}
                      metadata={activeSegment?.metadata}
                      style={{ color: '#fff3b0' }}
                    />
                  </div>
                  {showTranslations && currentUnit.translation && (
                    <div
                      className="mx-auto mt-2 max-w-4xl text-base font-medium leading-snug text-[rgba(255,255,255,0.9)] sm:text-xl"
                      style={{ textShadow: '0 2px 8px rgba(0, 0, 0, 0.75)' }}
                    >
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
        ref={stickyImageRef}
        className="retro-paper-panel sticky z-[8] mx-auto max-w-4xl overflow-hidden border-2 border-[rgba(20,50,86,0.12)] bg-[rgba(252,246,228,0.96)] shadow-[0_10px_0_rgba(17,51,92,0.08)]"
        style={{ top: readerImageTop }}
        data-testid="script-active-image-panel"
      >
        <div className="flex h-[min(34vh,22rem)] min-h-[11rem] w-full items-center justify-center bg-[rgba(20,50,86,0.08)] p-2 sm:p-3">
          {activeImageUrl ? (
            <img
              src={activeImageUrl}
              alt={displaySegment?.translation || 'Script scene illustration'}
              className="max-h-full max-w-full object-contain"
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

      <div className="mx-auto max-w-4xl space-y-3" data-testid="script-reader-lines">
        {script.segments.map((segment, index) => (
          <button
            key={segment.id}
            ref={(element) => {
              segmentRefs.current[index] = element;
            }}
            type="button"
            onClick={() => handleSeekToSegment(index)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`retro-paper-panel w-full text-left p-4 transition ${
              activeSegmentIndex === index
                ? 'border-2 border-[rgba(20,50,86,0.32)] bg-[rgba(247,199,68,0.38)] shadow-[0_8px_0_rgba(17,51,92,0.12)]'
                : 'bg-[rgba(255,255,255,0.55)]'
            }`}
            style={{ scrollMarginTop: readerLineScrollMarginTop }}
            data-active={activeSegmentIndex === index ? 'true' : 'false'}
            data-testid="script-segment-row"
          >
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
