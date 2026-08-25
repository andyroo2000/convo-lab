import { BookOpen, CalendarDays, ExternalLink, Languages, Play } from 'lucide-react';
import { useId } from 'react';
import { Link } from 'react-router-dom';
import type { StudyOverview } from '@languageflow/shared/src/types';
import { useTranslation } from 'react-i18next';

import { useGoogleCalendarConnection } from '../../hooks/useGoogleCalendarConnection';
import { useKnownKanji } from '../../hooks/useKnownKanji';
import estimateReviewMinutes, { calendarDayLabel } from '../../utils/studyTodayPresentation';
import MasterySpreadChart from './MasterySpreadChart';

interface StudyOverviewDashboardProps {
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
  overview,
  reviewAvailableCount,
  loading,
  error,
  onBeginReview,
  onBeginLesson,
  isStartingSession,
}: StudyOverviewDashboardProps) => {
  const { t, i18n } = useTranslation('study');
  const knownKanji = useKnownKanji();
  const googleCalendar = useGoogleCalendarConnection();
  const emptyStateId = useId();
  const reviewCountId = useId();
  const reviewTimeId = useId();
  const lessonCountId = useId();
  const showEmptyState = reviewAvailableCount === 0 && !loading;
  const beginStudyDisabled = isStartingSession || showEmptyState;
  const lessonsAvailable = overview?.newCardsAvailableToday ?? overview?.newCount ?? 0;
  const reviewEmptyMessage = lessonsAvailable > 0 ? t('overview.noReviews') : t('overview.empty');
  const readiness = overview?.learningReadiness;
  const estimatedMinutes = estimateReviewMinutes(
    reviewAvailableCount,
    readiness?.medianReviewDurationSeconds
  );
  const reviewCountText = t('overview.reviewCount', { count: reviewAvailableCount });
  let reviewTimeText = t('overview.reviewAllCaughtUp');
  if (reviewAvailableCount > 0) {
    reviewTimeText =
      estimatedMinutes === null
        ? t('overview.reviewEstimateCalibrating')
        : t('overview.reviewMinutes', { count: estimatedMinutes });
  }
  const newCardCountText = t('overview.newCardCount', { count: lessonsAvailable });
  const wanikani = knownKanji.data?.wanikani;
  const nextLesson = googleCalendar.data?.nextLesson;
  const locale = i18n.resolvedLanguage ?? i18n.language;
  let readinessBorderClass = 'border-l-red-500';
  if (readiness?.recommendation === 'ready') {
    readinessBorderClass = 'border-l-emerald-500';
  } else if (readiness?.recommendation === 'caution') {
    readinessBorderClass = 'border-l-amber-500';
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="study-today-title">
        <p
          id="study-today-title"
          className="mb-2 pl-1 text-xs font-black uppercase tracking-[0.2em] text-navy/60"
        >
          {t('overview.today')}
        </p>

        <div className="overflow-hidden rounded-[1.35rem] border-2 border-navy/10 bg-white/80 shadow-[0_8px_24px_rgba(17,51,92,0.08)]">
          <button
            type="button"
            onClick={onBeginReview}
            disabled={beginStudyDisabled}
            aria-label={t('overview.reviews')}
            aria-describedby={[reviewCountId, reviewTimeId, showEmptyState ? emptyStateId : null]
              .filter(Boolean)
              .join(' ')}
            className="flex min-h-32 w-full items-center gap-5 bg-navy px-5 py-5 text-left text-[#fbf5e0] transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-cyan disabled:cursor-not-allowed disabled:opacity-65 sm:px-6"
          >
            <span className="min-w-0 flex-1">
              <span className="mb-1 block text-sm font-bold text-[#fbf5e0]/80">
                {t('overview.convolabReviews')}
              </span>
              <span
                id={reviewCountId}
                className="block text-3xl font-black leading-none tracking-tight"
              >
                {reviewCountText}
              </span>
              <span id={reviewTimeId} className="mt-2 block text-sm text-[#fbf5e0]/75">
                {reviewTimeText}
              </span>
            </span>
            <span
              aria-hidden="true"
              className="grid size-14 shrink-0 place-items-center rounded-full bg-[#fbf5e0] text-navy shadow-lg"
            >
              <Play className="ml-0.5 size-6 fill-current" />
            </span>
          </button>

          <div className="grid grid-cols-2 divide-x divide-navy/10">
            <button
              type="button"
              onClick={onBeginLesson}
              disabled={isStartingSession || lessonsAvailable === 0}
              aria-label={t('overview.lessons')}
              aria-describedby={lessonCountId}
              className="min-h-28 px-4 py-4 text-left transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-55"
            >
              <span className="mb-2 grid size-8 place-items-center rounded-lg bg-emerald-700 text-white">
                <BookOpen aria-hidden="true" className="size-4" />
              </span>
              <span className="block font-bold text-navy">{t('overview.lessons')}</span>
              <span id={lessonCountId} className="mt-0.5 block text-sm text-gray-600">
                {newCardCountText}
              </span>
            </button>

            <a
              href="https://www.wanikani.com/subjects/review"
              target="_blank"
              rel="noreferrer"
              className="min-h-28 px-4 py-4 text-left transition hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#ee685a]"
            >
              <span className="mb-2 grid size-8 place-items-center rounded-lg bg-[#ee685a] text-white">
                <Languages aria-hidden="true" className="size-4" />
              </span>
              <span className="flex items-center gap-1 font-bold text-navy">
                WaniKani <ExternalLink aria-hidden="true" className="size-3.5" />
              </span>
              <span className="mt-0.5 block text-sm text-gray-600">
                {typeof wanikani?.reviewCount === 'number'
                  ? t('overview.wanikaniReviewCount', { count: wanikani.reviewCount })
                  : t('overview.openWanikaniReviews')}
              </span>
            </a>
          </div>

          {nextLesson ? (
            <Link
              to="/app/study/time"
              className="flex min-h-20 items-center gap-3 border-t border-navy/10 px-4 py-3 transition hover:bg-cyan/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-cyan"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan text-white">
                <CalendarDays aria-hidden="true" className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold uppercase tracking-[0.1em] text-gray-500">
                  {t('overview.nextLesson')}
                </span>
                <span className="block truncate font-bold text-navy">{nextLesson.title}</span>
              </span>
              <span className="shrink-0 text-right text-sm font-bold text-navy">
                <span className="block">
                  {calendarDayLabel(new Date(nextLesson.startsAt), locale)}
                </span>
                <span className="block text-xs font-medium text-gray-500">
                  {new Intl.DateTimeFormat(locale, {
                    hour: 'numeric',
                    minute: '2-digit',
                  }).format(new Date(nextLesson.startsAt))}
                </span>
              </span>
            </Link>
          ) : null}
        </div>

        <p className="mt-2 pr-1 text-right text-xs text-gray-500">
          {t('overview.totalCardCount', {
            count: overview?.totalCards ?? 0,
            formattedCount: new Intl.NumberFormat(locale).format(overview?.totalCards ?? 0),
          })}
        </p>

        {showEmptyState ? (
          <p id={emptyStateId} className="mt-2 text-sm text-gray-600">
            {reviewEmptyMessage}
          </p>
        ) : null}
        {loading ? <p className="mt-2 text-gray-500">{t('overview.loading')}</p> : null}
        {error ? <p className="mt-2 text-red-600">{error.message}</p> : null}
      </section>

      <nav aria-label={t('overview.studyTools')} className="flex flex-wrap gap-2">
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
      </nav>

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
