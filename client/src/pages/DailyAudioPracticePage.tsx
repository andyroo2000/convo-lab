import {
  forwardRef,
  type ReactNode,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ChevronLeft, ChevronRight, Headphones, RefreshCw } from 'lucide-react';

import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'framer-motion';

import ScriptTrackPlayer from '../components/audio/ScriptTrackPlayer';
import ConfirmModal from '../components/common/ConfirmModal';
import StudyCapabilitiesError from '../components/study/StudyCapabilitiesError';
import {
  dailyAudioPracticeKeys,
  type DailyAudioDurationMinutes,
  useCreateDailyAudioPractice,
  useDailyAudioPractice,
  useDailyAudioPracticeStatus,
  useRecentDailyAudioPractice,
} from '../hooks/useDailyAudioPractice';
import { useStudyCapabilities } from '../hooks/useStudyCapabilities';
import type { DailyAudioPractice } from '../types';

const GENERATION_STALE_AFTER_MS = 90 * 60 * 1000;
const SWIPE_THRESHOLD_PX = 50;

function dailyAudioDurationOptions(min: number, max: number, defaultValue: number): number[] {
  const options = [min, defaultValue, max];
  for (let duration = Math.ceil(min / 15) * 15; duration <= max; duration += 15) {
    options.push(duration);
  }
  return [...new Set(options)].sort((left, right) => left - right);
}

function localPracticeDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function dayNavigationHint(canShowEarlier: boolean, canShowLater: boolean) {
  if (canShowEarlier && canShowLater) {
    return 'Swipe right for earlier days or left for later days.';
  }
  if (canShowEarlier) return 'Swipe right for earlier days.';
  if (canShowLater) return 'Swipe left for later days.';
  return null;
}

function slideOffset(direction: 1 | -1, phase: 'enter' | 'exit', reduceMotion: boolean | null) {
  if (reduceMotion) return 0;
  if (phase === 'enter') return direction === 1 ? '-105%' : '105%';
  return direction === 1 ? '105%' : '-105%';
}

const AnimatedDay = forwardRef<
  HTMLDivElement,
  {
    children: ReactNode;
    direction: 1 | -1;
    reduceMotion: boolean | null;
  }
>(({ children, direction, reduceMotion }, forwardedRef) => {
  const isPresent = useIsPresent();
  const ref = useRef<HTMLDivElement | null>(null);
  useImperativeHandle(forwardedRef, () => ref.current as HTMLDivElement);

  useEffect(() => {
    if (ref.current) {
      ref.current.inert = !isPresent;
    }
  }, [isPresent]);

  return (
    <motion.div
      ref={ref}
      custom={direction}
      aria-hidden={isPresent ? undefined : true}
      className={isPresent ? undefined : 'pointer-events-none'}
      variants={{
        enter: (nextDirection: 1 | -1) => ({
          x: slideOffset(nextDirection, 'enter', reduceMotion),
          opacity: reduceMotion ? 1 : 0.72,
        }),
        center: { x: 0, opacity: 1 },
        exit: (nextDirection: 1 | -1) => ({
          x: slideOffset(nextDirection, 'exit', reduceMotion),
          opacity: reduceMotion ? 1 : 0.72,
        }),
      }}
      initial="enter"
      animate="center"
      exit="exit"
      transition={
        reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 34, mass: 0.9 }
      }
    >
      {children}
    </motion.div>
  );
});

AnimatedDay.displayName = 'AnimatedDay';

interface DailyAudioHeaderProps {
  activeTodayGeneration: boolean;
  durationAvailable: boolean;
  durationOptions: number[];
  generateButtonLabel: string;
  isCreating: boolean;
  onGenerate: () => void;
  setTargetDurationMinutes: (duration: DailyAudioDurationMinutes) => void;
  targetDurationMinutes: DailyAudioDurationMinutes | null;
}

const DailyAudioHeader = ({
  activeTodayGeneration,
  durationAvailable,
  durationOptions,
  generateButtonLabel,
  isCreating,
  onGenerate,
  setTargetDurationMinutes,
  targetDurationMinutes,
}: DailyAudioHeaderProps) => (
  <section className="retro-paper-panel border-2 border-[rgba(20,50,86,0.12)] bg-[rgba(20,141,189,0.22)] px-4 py-5 shadow-[0_8px_0_rgba(17,51,92,0.1)] sm:px-5">
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div>
        <div className="retro-caps mb-2 text-[rgba(20,50,86,0.62)]">Study audio</div>
        <h1 className="retro-headline text-4xl sm:text-6xl">Daily Audio Practice</h1>
        <p className="mt-2 max-w-3xl text-lg text-[rgba(20,50,86,0.76)]">
          Generate audio drills based on words and grammar structures you are currently working on.
        </p>
      </div>
      <div className="space-y-3">
        <fieldset disabled={isCreating || activeTodayGeneration || !durationAvailable}>
          <legend className="retro-caps mb-2 text-[rgba(20,50,86,0.62)]">Edition length</legend>
          <div className="flex flex-wrap gap-1" aria-label="Edition length">
            {durationOptions.map((duration) => (
              <button
                key={duration}
                type="button"
                aria-pressed={targetDurationMinutes === duration}
                onClick={() => setTargetDurationMinutes(duration)}
                className={`min-h-10 border-2 px-3 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  targetDurationMinutes === duration
                    ? 'border-navy bg-navy text-[#fbf5e0]'
                    : 'border-navy/20 bg-[#fbf5e0]/80 text-navy hover:bg-white'
                }`}
              >
                {duration} min
              </button>
            ))}
          </div>
        </fieldset>
        <button
          type="button"
          onClick={onGenerate}
          disabled={isCreating || activeTodayGeneration || targetDurationMinutes === null}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 border-2 border-navy/20 bg-navy px-5 py-3 font-black uppercase tracking-[0.01em] text-[#fbf5e0] shadow-[0_5px_0_rgba(17,51,92,0.18)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {activeTodayGeneration ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Headphones className="h-4 w-4" />
          )}
          {generateButtonLabel}
        </button>
      </div>
    </div>
  </section>
);

const LoadingPractice = () => (
  <section className="card retro-paper-panel py-12 text-center">
    <div className="loading-spinner mx-auto mb-4 h-12 w-12 rounded-full border-4 border-indigo border-t-transparent" />
    <p className="text-gray-600">Loading daily audio practice...</p>
  </section>
);

const EmptyPractice = () => (
  <section className="card retro-paper-panel space-y-3 py-10 text-center">
    <h2 className="retro-headline text-3xl">Ready when you are</h2>
    <p className="mx-auto max-w-xl text-gray-600">
      Your daily drills, dialogues, and story will appear here after generation.
    </p>
  </section>
);

const GenerationError = ({ practice }: { practice: DailyAudioPractice }) => (
  <section className="retro-paper-panel border-2 border-red-200 bg-red-50 px-4 py-5">
    <h2 className="text-xl font-bold text-red-900">Generation failed</h2>
    <p className="mt-2 text-red-700">
      {practice.errorMessage || 'Daily audio practice could not be generated.'}
    </p>
  </section>
);

const CreatePracticeError = ({ error }: { error: unknown }) => (
  <section className="retro-paper-panel border-2 border-red-200 bg-red-50 px-4 py-5">
    <h2 className="text-xl font-bold text-red-900">Could not start practice</h2>
    <p className="mt-2 text-red-700">
      {error instanceof Error ? error.message : 'Daily audio practice could not be started.'}
    </p>
  </section>
);

const StaleGeneration = () => (
  <section className="retro-paper-panel border-2 border-amber-200 bg-amber-50 px-4 py-5">
    <h2 className="text-xl font-bold text-amber-950">Generation is taking longer than expected</h2>
    <p className="mt-2 text-amber-800">
      Start a new generation to retry today&apos;s practice set.
    </p>
  </section>
);

const GenerationProgress = ({
  practice,
  progress,
}: {
  practice: DailyAudioPractice;
  progress: number | null;
}) => (
  <section className="retro-paper-panel border-2 border-[rgba(20,50,86,0.12)] bg-[rgba(252,246,228,0.92)] px-4 py-5 shadow-[0_8px_0_rgba(17,51,92,0.1)] sm:px-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="retro-headline text-3xl">
          Generating today&apos;s {practice.targetDurationMinutes}-minute edition
        </h2>
        <p className="text-[rgba(20,50,86,0.68)]">
          {practice.tracks
            .map((track) => `${track.title}: ${formatStatus(track.status)}`)
            .join(' - ')}
        </p>
      </div>
      <span className="retro-caps text-[rgba(20,50,86,0.68)]">{progress ?? 0}%</span>
    </div>
    <div className="mt-4 h-3 overflow-hidden border-2 border-[rgba(20,50,86,0.14)] bg-white/60">
      <div
        className="h-full bg-[#1ab2d1] transition-all"
        style={{ width: `${Math.min(progress ?? 0, 100)}%` }}
      />
    </div>
  </section>
);

const ReadyPractice = ({ practice }: { practice: DailyAudioPractice }) => {
  const sourceSummary = practice.selectionSummaryJson;
  return (
    <>
      <section className="retro-paper-panel border-2 border-[rgba(20,50,86,0.12)] bg-[rgba(252,246,228,0.92)] px-4 py-4 shadow-[0_8px_0_rgba(17,51,92,0.1)] sm:px-5">
        <div className="grid gap-3 sm:grid-cols-5">
          <div>
            <p className="retro-caps text-[rgba(20,50,86,0.5)]">Edition</p>
            <p className="text-2xl font-black text-navy">{practice.targetDurationMinutes} min</p>
          </div>
          <div>
            <p className="retro-caps text-[rgba(20,50,86,0.5)]">Date</p>
            <p className="text-2xl font-black text-navy">{practice.practiceDate}</p>
          </div>
          <div>
            <p className="retro-caps text-[rgba(20,50,86,0.5)]">Cards</p>
            <p className="text-2xl font-black text-navy">
              {sourceSummary?.selectedCount ?? practice.sourceCardIdsJson?.length ?? 0}
            </p>
          </div>
          <div>
            <p className="retro-caps text-[rgba(20,50,86,0.5)]">Due</p>
            <p className="text-2xl font-black text-navy">{sourceSummary?.dueCount ?? 0}</p>
          </div>
          <div>
            <p className="retro-caps text-[rgba(20,50,86,0.5)]">Learning</p>
            <p className="text-2xl font-black text-navy">{sourceSummary?.learningCount ?? 0}</p>
          </div>
        </div>
      </section>
      <div className="space-y-4">
        {practice.tracks.map((track) => (
          <ScriptTrackPlayer
            key={track.id}
            title={track.title}
            status={track.status}
            audioUrl={track.audioUrl}
            scriptUnits={track.scriptUnitsJson}
            timingData={track.timingData}
            approxDurationSeconds={track.approxDurationSeconds}
            updatedAt={track.updatedAt}
            targetLanguage={practice.targetLanguage}
          />
        ))}
      </div>
    </>
  );
};

interface DayContentProps {
  createError: unknown;
  createFailed: boolean;
  practice: DailyAudioPractice | undefined;
  progress: number | null;
  staleGeneration: boolean;
}

const PracticeStatusContent = ({
  practice,
  progress,
  staleGeneration,
}: Pick<DayContentProps, 'practice' | 'progress' | 'staleGeneration'>) => {
  if (!practice) return null;
  if (!staleGeneration) {
    if (practice.status === 'generating' || practice.status === 'draft') {
      return <GenerationProgress practice={practice} progress={progress} />;
    }
  }
  if (practice.status === 'ready') return <ReadyPractice practice={practice} />;
  return null;
};

const DayContent = ({
  createError,
  createFailed,
  practice,
  progress,
  staleGeneration,
}: DayContentProps) => (
  <>
    {practice?.status === 'error' && <GenerationError practice={practice} />}
    {createFailed && <CreatePracticeError error={createError} />}
    {staleGeneration && <StaleGeneration />}
    <PracticeStatusContent
      practice={practice}
      progress={progress}
      staleGeneration={staleGeneration}
    />
  </>
);

interface DayNavigationProps {
  canShowEarlier: boolean;
  canShowLater: boolean;
  navigationHint: string | null;
  showEarlier: () => void;
  showLater: () => void;
}

const DayNavigation = ({
  canShowEarlier,
  canShowLater,
  navigationHint,
  showEarlier,
  showLater,
}: DayNavigationProps) => (
  <div className="flex flex-wrap items-center justify-center gap-3">
    <button
      type="button"
      onClick={showEarlier}
      disabled={!canShowEarlier}
      className="btn-outline inline-flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <ChevronLeft className="h-4 w-4" />
      Earlier day
    </button>
    {navigationHint && (
      <p className="text-center text-sm text-[rgba(20,50,86,0.58)]">{navigationHint}</p>
    )}
    <button
      type="button"
      onClick={showLater}
      disabled={!canShowLater}
      className="btn-outline inline-flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-40"
    >
      Later day
      <ChevronRight className="h-4 w-4" />
    </button>
  </div>
);

const DailyAudioPracticePage = () => {
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const recentQuery = useRecentDailyAudioPractice();
  const [selectedPracticeId, setSelectedPracticeId] = useState<string | undefined>();
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  const [confirmingRegeneration, setConfirmingRegeneration] = useState(false);
  const capabilitiesQuery = useStudyCapabilities();
  const durationCapability = capabilitiesQuery.data?.dailyAudio.targetDurationMinutes;
  const durationOptions = useMemo(
    () =>
      durationCapability
        ? dailyAudioDurationOptions(
            durationCapability.min,
            durationCapability.max,
            durationCapability.default
          )
        : [],
    [durationCapability]
  );
  const [targetDurationMinutes, setTargetDurationMinutes] =
    useState<DailyAudioDurationMinutes | null>(null);
  const [generationClock, setGenerationClock] = useState(() => Date.now());
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const dayRegionRef = useRef<HTMLDivElement>(null);
  const createPractice = useCreateDailyAudioPractice();
  useEffect(() => {
    if (durationCapability && targetDurationMinutes === null) {
      setTargetDurationMinutes(durationCapability.default);
    }
  }, [durationCapability, targetDurationMinutes]);
  const practices = useMemo(
    () =>
      [...(recentQuery.data ?? [])].sort((a, b) => b.practiceDate.localeCompare(a.practiceDate)),
    [recentQuery.data]
  );
  const todayPractice = practices.find((item) => item.practiceDate === localPracticeDate());
  const todayGenerating = todayPractice?.status === 'generating';
  const todayHasAudio = todayPractice?.status === 'ready';
  const todayGenerationUpdatedAt = todayPractice?.updatedAt
    ? new Date(todayPractice.updatedAt).getTime()
    : null;
  const staleTodayGeneration =
    Boolean(todayGenerating) &&
    todayGenerationUpdatedAt !== null &&
    generationClock - todayGenerationUpdatedAt > GENERATION_STALE_AFTER_MS;
  const activeTodayGeneration = Boolean(todayGenerating && !staleTodayGeneration);

  useEffect(() => {
    if (!todayGenerating || todayGenerationUpdatedAt === null || staleTodayGeneration) {
      return undefined;
    }

    const staleAt = todayGenerationUpdatedAt + GENERATION_STALE_AFTER_MS;
    const timer = window.setTimeout(
      () => setGenerationClock(Date.now()),
      Math.max(staleAt - Date.now() + 1, 1)
    );
    return () => window.clearTimeout(timer);
  }, [staleTodayGeneration, todayGenerating, todayGenerationUpdatedAt]);

  useEffect(() => {
    if (!selectedPracticeId && practices[0]) {
      setSelectedPracticeId(practices[0].id);
    }
  }, [practices, selectedPracticeId]);

  const detailQuery = useDailyAudioPractice(selectedPracticeId);
  const practice = detailQuery.data ?? practices.find((item) => item.id === selectedPracticeId);
  const generating = practice?.status === 'generating';
  const selectedPracticeIsToday = Boolean(practice?.id && practice.id === todayPractice?.id);
  const staleGeneration = selectedPracticeIsToday && staleTodayGeneration;
  const statusQuery = useDailyAudioPracticeStatus(todayPractice?.id, activeTodayGeneration);

  useEffect(() => {
    const status = statusQuery.data?.status;
    if (!todayPractice?.id || (status !== 'ready' && status !== 'error')) return;
    queryClient.invalidateQueries({ queryKey: dailyAudioPracticeKeys.detail(todayPractice.id) });
    queryClient.invalidateQueries({ queryKey: dailyAudioPracticeKeys.list() });
  }, [queryClient, statusQuery.data?.status, todayPractice?.id]);

  const selectedIndex = practices.findIndex((item) => item.id === selectedPracticeId);
  const canShowEarlier = selectedIndex >= 0 && selectedIndex < practices.length - 1;
  const canShowLater = selectedIndex > 0;
  const navigationHint = dayNavigationHint(canShowEarlier, canShowLater);

  const pauseDayAudio = () => {
    dayRegionRef.current?.querySelectorAll('audio').forEach((audio) => audio.pause());
  };

  const showEarlier = () => {
    if (canShowEarlier) {
      pauseDayAudio();
      setSlideDirection(1);
      setSelectedPracticeId(practices[selectedIndex + 1].id);
    }
  };

  const showLater = () => {
    if (canShowLater) {
      pauseDayAudio();
      setSlideDirection(-1);
      setSelectedPracticeId(practices[selectedIndex - 1].id);
    }
  };

  const handleSwipeEnd = (clientX: number, clientY: number) => {
    if (swipeStart.current === null) return;
    const horizontalDistance = clientX - swipeStart.current.x;
    const verticalDistance = clientY - swipeStart.current.y;
    swipeStart.current = null;
    if (
      Math.abs(horizontalDistance) <= SWIPE_THRESHOLD_PX ||
      Math.abs(horizontalDistance) <= Math.abs(verticalDistance)
    ) {
      return;
    }
    if (horizontalDistance > 0) showEarlier();
    if (horizontalDistance < 0) showLater();
  };

  const handleGenerate = async () => {
    try {
      if (targetDurationMinutes === null) return;
      const nextPractice = await createPractice.mutateAsync(targetDurationMinutes);
      setSelectedPracticeId(nextPractice.id);
    } catch {
      // React Query retains the mutation error for the inline alert below.
    }
  };

  const handleGenerateRequest = () => {
    if (todayHasAudio) {
      setConfirmingRegeneration(true);
      return;
    }
    handleGenerate();
  };

  const loading = recentQuery.isLoading || Boolean(selectedPracticeId && detailQuery.isLoading);
  let progress: number | null = generating ? 0 : null;
  if (selectedPracticeIsToday && statusQuery.data?.progress !== undefined) {
    progress = statusQuery.data.progress;
  }
  let generateButtonLabel = "Generate Today's Audio";
  if (todayHasAudio) generateButtonLabel = "Regenerate Today's Audio";
  if (staleTodayGeneration) generateButtonLabel = "Retry Today's Audio";

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <DailyAudioHeader
        activeTodayGeneration={activeTodayGeneration}
        durationAvailable={Boolean(durationCapability)}
        durationOptions={durationOptions}
        generateButtonLabel={generateButtonLabel}
        isCreating={createPractice.isPending}
        onGenerate={handleGenerateRequest}
        setTargetDurationMinutes={setTargetDurationMinutes}
        targetDurationMinutes={targetDurationMinutes}
      />

      <StudyCapabilitiesError
        isError={capabilitiesQuery.isError}
        isRetrying={capabilitiesQuery.isFetching}
        onRetry={() => {
          capabilitiesQuery.refetch().catch(() => undefined);
        }}
      />

      {loading && <LoadingPractice />}
      {!loading && !practice && <EmptyPractice />}

      <div
        ref={dayRegionRef}
        className="relative overflow-clip"
        style={{ overflowClipMargin: '12px' }}
        data-testid="daily-audio-day"
        role="region"
        aria-label="Daily Audio day"
        onTouchStart={(event) => {
          const touch = event.touches[0];
          swipeStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
        }}
        onTouchEnd={(event) => {
          const touch = event.changedTouches[0];
          if (touch) {
            handleSwipeEnd(touch.clientX, touch.clientY);
          } else {
            swipeStart.current = null;
          }
        }}
        onTouchCancel={() => {
          swipeStart.current = null;
        }}
      >
        <AnimatePresence initial={false} custom={slideDirection} mode="popLayout">
          <AnimatedDay
            key={practice?.id ?? 'empty-daily-audio-day'}
            direction={slideDirection}
            reduceMotion={reduceMotion}
          >
            <DayContent
              createError={createPractice.error}
              createFailed={createPractice.isError}
              practice={practice}
              progress={progress}
              staleGeneration={staleGeneration}
            />
          </AnimatedDay>
        </AnimatePresence>
      </div>

      {practices.length > 1 && (
        <DayNavigation
          canShowEarlier={canShowEarlier}
          canShowLater={canShowLater}
          navigationHint={navigationHint}
          showEarlier={showEarlier}
          showLater={showLater}
        />
      )}

      <ConfirmModal
        isOpen={confirmingRegeneration}
        title="Regenerate today’s audio?"
        message={`This will overwrite today’s existing audio with a ${targetDurationMinutes}-minute edition. Previously downloaded versions may need to be downloaded again.`}
        confirmLabel="Regenerate Audio"
        cancelLabel="Keep Existing Audio"
        variant="warning"
        onCancel={() => setConfirmingRegeneration(false)}
        onConfirm={() => {
          setConfirmingRegeneration(false);
          handleGenerate();
        }}
      />
    </div>
  );
};

export default DailyAudioPracticePage;
