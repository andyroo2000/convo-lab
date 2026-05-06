import { useEffect, useMemo, useState } from 'react';
import { Headphones, RefreshCw } from 'lucide-react';

import { useQueryClient } from '@tanstack/react-query';

import ScriptTrackPlayer from '../components/audio/ScriptTrackPlayer';
import {
  dailyAudioPracticeKeys,
  useCreateDailyAudioPractice,
  useDailyAudioPractice,
  useDailyAudioPracticeStatus,
  useRecentDailyAudioPractice,
} from '../hooks/useDailyAudioPractice';

const GENERATION_STALE_AFTER_MS = 90 * 60 * 1000;

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

const DailyAudioPracticePage = () => {
  const queryClient = useQueryClient();
  const recentQuery = useRecentDailyAudioPractice();
  const [selectedPracticeId, setSelectedPracticeId] = useState<string | undefined>();
  const createPractice = useCreateDailyAudioPractice();

  useEffect(() => {
    if (!selectedPracticeId && recentQuery.data?.[0]) {
      setSelectedPracticeId(recentQuery.data[0].id);
    }
  }, [recentQuery.data, selectedPracticeId]);

  const detailQuery = useDailyAudioPractice(selectedPracticeId);
  const practice =
    detailQuery.data ?? recentQuery.data?.find((item) => item.id === selectedPracticeId);
  const generating = practice?.status === 'generating';
  const generationUpdatedAt = practice?.updatedAt ? new Date(practice.updatedAt).getTime() : null;
  const staleGeneration =
    Boolean(generating) &&
    generationUpdatedAt !== null &&
    Date.now() - generationUpdatedAt > GENERATION_STALE_AFTER_MS;
  const statusQuery = useDailyAudioPracticeStatus(
    practice?.id,
    Boolean(generating && !staleGeneration)
  );

  useEffect(() => {
    const status = statusQuery.data?.status;
    if (!practice?.id || (status !== 'ready' && status !== 'error')) return;
    queryClient.invalidateQueries({ queryKey: dailyAudioPracticeKeys.detail(practice.id) });
    queryClient.invalidateQueries({ queryKey: dailyAudioPracticeKeys.list() });
  }, [practice?.id, queryClient, statusQuery.data?.status]);

  const sourceSummary = practice?.selectionSummaryJson;
  const tracks = useMemo(() => practice?.tracks ?? [], [practice?.tracks]);

  const handleGenerate = async () => {
    try {
      const nextPractice = await createPractice.mutateAsync();
      setSelectedPracticeId(nextPractice.id);
    } catch {
      // React Query retains the mutation error for the inline alert below.
    }
  };

  const loading = recentQuery.isLoading || Boolean(selectedPracticeId && detailQuery.isLoading);
  const progress = statusQuery.data?.progress ?? (generating ? 0 : null);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <section className="retro-paper-panel border-2 border-[rgba(20,50,86,0.12)] bg-[rgba(20,141,189,0.22)] px-4 py-5 shadow-[0_8px_0_rgba(17,51,92,0.1)] sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="retro-caps mb-2 text-[rgba(20,50,86,0.62)]">Study audio</div>
            <h1 className="retro-headline text-4xl sm:text-6xl">Daily Audio Practice</h1>
            <p className="mt-2 max-w-3xl text-lg text-[rgba(20,50,86,0.76)]">
              Generate focused drill audio from the cards you are learning.
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={createPractice.isPending || generating}
            className="inline-flex min-h-12 items-center gap-2 border-2 border-navy/20 bg-navy px-5 py-3 font-black uppercase tracking-[0.01em] text-[#fbf5e0] shadow-[0_5px_0_rgba(17,51,92,0.18)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Headphones className="h-4 w-4" />
            )}
            {practice ? 'Generate today' : 'Create today'}
          </button>
        </div>
      </section>

      {loading ? (
        <section className="card retro-paper-panel py-12 text-center">
          <div className="loading-spinner mx-auto mb-4 h-12 w-12 rounded-full border-4 border-indigo border-t-transparent" />
          <p className="text-gray-600">Loading daily audio practice...</p>
        </section>
      ) : null}

      {!loading && !practice ? (
        <section className="card retro-paper-panel space-y-3 py-10 text-center">
          <h2 className="retro-headline text-3xl">Ready when you are</h2>
          <p className="mx-auto max-w-xl text-gray-600">
            Create a drill track from your current flashcards. Dialogues and story are skipped while
            this is in development.
          </p>
        </section>
      ) : null}

      {practice?.status === 'error' ? (
        <section className="retro-paper-panel border-2 border-red-200 bg-red-50 px-4 py-5">
          <h2 className="text-xl font-bold text-red-900">Generation failed</h2>
          <p className="mt-2 text-red-700">
            {practice.errorMessage || 'Daily audio practice could not be generated.'}
          </p>
        </section>
      ) : null}

      {createPractice.isError ? (
        <section className="retro-paper-panel border-2 border-red-200 bg-red-50 px-4 py-5">
          <h2 className="text-xl font-bold text-red-900">Could not start practice</h2>
          <p className="mt-2 text-red-700">
            {createPractice.error instanceof Error
              ? createPractice.error.message
              : 'Daily audio practice could not be started.'}
          </p>
        </section>
      ) : null}

      {staleGeneration ? (
        <section className="retro-paper-panel border-2 border-amber-200 bg-amber-50 px-4 py-5">
          <h2 className="text-xl font-bold text-amber-950">
            Generation is taking longer than expected
          </h2>
          <p className="mt-2 text-amber-800">
            Start a new generation to retry today&apos;s practice set.
          </p>
        </section>
      ) : null}

      {practice && (practice.status === 'generating' || practice.status === 'draft') ? (
        <section className="retro-paper-panel border-2 border-[rgba(20,50,86,0.12)] bg-[rgba(252,246,228,0.92)] px-4 py-5 shadow-[0_8px_0_rgba(17,51,92,0.1)] sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="retro-headline text-3xl">Generating today&apos;s tracks</h2>
              <p className="text-[rgba(20,50,86,0.68)]">
                {tracks.map((track) => `${track.title}: ${formatStatus(track.status)}`).join(' - ')}
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
      ) : null}

      {practice?.status === 'ready' ? (
        <>
          <section className="retro-paper-panel border-2 border-[rgba(20,50,86,0.12)] bg-[rgba(252,246,228,0.92)] px-4 py-4 shadow-[0_8px_0_rgba(17,51,92,0.1)] sm:px-5">
            <div className="grid gap-3 sm:grid-cols-4">
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
            {tracks.map((track) => (
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
      ) : null}
    </div>
  );
};

export default DailyAudioPracticePage;
