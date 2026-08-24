import { useId } from 'react';
import { Link } from 'react-router-dom';
import type { StudyOverview } from '@languageflow/shared/src/types';
import { useTranslation } from 'react-i18next';

import MasterySpreadChart from './MasterySpreadChart';

interface StudyOverviewDashboardProps {
  headline: string;
  overview: StudyOverview | undefined;
  reviewAvailableCount: number;
  loading: boolean;
  error: Error | null;
  onBeginReview: () => void;
  onBeginLesson: () => void;
  isStartingSession: boolean;
}

const STUDY_ACTION_CLASS =
  'inline-flex min-h-11 items-center justify-center border-2 border-[#8b756d] bg-[#bfa192] px-4 py-2 text-center font-semibold uppercase tracking-[0.08em] text-[#fbf5e0] shadow-[0_4px_0_rgba(75,24,0,0.18)] transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dark-brown';

const StudyOverviewDashboard = ({
  headline,
  overview,
  reviewAvailableCount,
  loading,
  error,
  onBeginReview,
  onBeginLesson,
  isStartingSession,
}: StudyOverviewDashboardProps) => {
  const { t } = useTranslation('study');
  const emptyStateId = useId();
  const showEmptyState = reviewAvailableCount === 0 && !loading;
  const beginStudyDisabled = isStartingSession || showEmptyState;
  const lessonsAvailable = overview?.newCount ?? 0;
  const reviewEmptyMessage = lessonsAvailable > 0 ? t('overview.noReviews') : t('overview.empty');
  const readiness = overview?.learningReadiness;
  let readinessBorderClass = 'border-l-red-500';
  if (readiness?.recommendation === 'ready') {
    readinessBorderClass = 'border-l-emerald-500';
  } else if (readiness?.recommendation === 'caution') {
    readinessBorderClass = 'border-l-amber-500';
  }

  return (
    <div className="space-y-6">
      <section className="card retro-paper-panel space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Keeps the primary action stable when the headline wraps. */}
          <div className="min-w-[20rem]">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onBeginReview}
                disabled={beginStudyDisabled}
                aria-describedby={showEmptyState ? emptyStateId : undefined}
                className="inline-flex min-h-14 items-center justify-center border-2 border-navy/20 bg-navy px-6 py-3 font-black uppercase leading-none tracking-[0.01em] text-[#fbf5e0] shadow-[0_5px_0_rgba(17,51,92,0.18)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t('overview.reviews')}
              </button>
              <button
                type="button"
                onClick={onBeginLesson}
                disabled={isStartingSession || lessonsAvailable === 0}
                className="inline-flex min-h-14 items-center justify-center border-2 border-emerald-700/20 bg-emerald-700 px-6 py-3 font-black uppercase leading-none tracking-[0.01em] text-white shadow-[0_5px_0_rgba(4,120,87,0.18)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t('overview.lessons')}
              </button>
            </div>
            <p className="mt-2 text-gray-600">{headline}</p>
            {showEmptyState ? (
              <p id={emptyStateId} className="mt-2 max-w-xs text-sm text-gray-600">
                {reviewEmptyMessage}
              </p>
            ) : null}
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
            <Link to="/app/study/cards" className={STUDY_ACTION_CLASS}>
              {t('overview.cards')}
            </Link>
            <Link to="/app/study/browse" className={STUDY_ACTION_CLASS}>
              {t('overview.browse')}
            </Link>
            <Link to="/app/study/import" className={STUDY_ACTION_CLASS}>
              {t('overview.import')}
            </Link>
            <Link to="/app/study/create" className={STUDY_ACTION_CLASS}>
              {t('overview.create')}
            </Link>
            <Link to="/app/study/daily-audio" className={STUDY_ACTION_CLASS}>
              {t('overview.dailyAudio')}
            </Link>
            <Link to="/app/study/settings" className={STUDY_ACTION_CLASS}>
              {t('overview.settings')}
            </Link>
          </div>
        </div>
        {loading ? <p className="text-gray-500">{t('overview.loading')}</p> : null}
        {error ? <p className="text-red-600">{error.message}</p> : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card retro-paper-panel">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{t('overview.due')}</p>
          <p className="text-3xl font-bold text-navy">{reviewAvailableCount}</p>
        </div>
        <div className="card retro-paper-panel">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{t('overview.total')}</p>
          <p className="text-3xl font-bold text-navy">{overview?.totalCards ?? 0}</p>
        </div>
      </section>

      {readiness ? (
        <section className={`card retro-paper-panel border-l-4 ${readinessBorderClass}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
            {t('readiness.title')}
          </p>
          <h2 className="mt-1 text-2xl font-bold capitalize text-navy">
            {t(`readiness.${readiness.recommendation}`)}
          </h2>
          <p className="mt-2 max-w-3xl text-gray-600">
            {readiness.sufficientData && readiness.recentRecall !== null
              ? t('readiness.withData', {
                  recall: Math.round(readiness.recentRecall * 100),
                  target: Math.round(readiness.targetRecall * 100),
                  apprentice: readiness.apprenticeCount,
                  projected: readiness.projectedSevenDayReviews,
                })
              : t('readiness.building', {
                  sample: readiness.sampleSize,
                  projected: readiness.projectedSevenDayReviews,
                })}
          </p>
          {readiness.recommendation !== 'ready' ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onBeginReview}
                disabled={beginStudyDisabled}
                className={STUDY_ACTION_CLASS}
              >
                {t('readiness.reviewNow')}
              </button>
              <button
                type="button"
                onClick={onBeginLesson}
                disabled={isStartingSession || lessonsAvailable === 0}
                className={STUDY_ACTION_CLASS}
              >
                {t('readiness.learnAnyway')}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {overview?.masterySpread ? <MasterySpreadChart spread={overview.masterySpread} /> : null}
    </div>
  );
};

export default StudyOverviewDashboard;
