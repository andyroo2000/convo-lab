import { BookOpen, CalendarDays, ExternalLink, Languages, Play } from 'lucide-react';
import { useId } from 'react';
import { Link } from 'react-router-dom';
import type { StudyOverview } from '@languageflow/shared/src/types';
import { useTranslation } from 'react-i18next';

import { useGoogleCalendarConnection } from '../../hooks/useGoogleCalendarConnection';
import { useKnownKanji } from '../../hooks/useKnownKanji';
import estimateReviewMinutes, { calendarDayLabel } from '../../utils/studyTodayPresentation';
import StudyPileShelf from './StudyPileShelf';
import MasterySpreadChart from './MasterySpreadChart';

interface StudyOverviewDashboardProps {
  overview: StudyOverview | undefined;
  reviewAvailableCount: number;
  loading: boolean;
  error: Error | null;
  onBeginReview: () => void;
  onBeginLesson: (pileId?: string) => void;
  isStartingSession: boolean;
}

const STUDY_ACTION_CLASS =
  'study-console-action inline-flex min-h-11 items-center justify-center px-4 py-2 text-center font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan';

const getTotalCards = (overview: StudyOverview | undefined) => overview?.totalCards ?? 0;

const getLessonCount = (overview: StudyOverview | undefined) =>
  overview?.newCardsAvailableToday ?? overview?.newCount ?? 0;

function getReviewTimeText(
  t: ReturnType<typeof useTranslation>['t'],
  count: number,
  minutes: number | null
) {
  if (count === 0) return t('overview.reviewAllCaughtUp');
  return minutes === null
    ? t('overview.reviewEstimateCalibrating')
    : t('overview.reviewMinutes', { count: minutes });
}

function getReadinessBorderClass(recommendation: string | undefined) {
  if (recommendation === 'ready') return 'border-l-emerald-500';
  return recommendation === 'caution' ? 'border-l-amber-500' : 'border-l-red-500';
}

function useDashboardState({
  overview,
  reviewAvailableCount,
  loading,
  isStartingSession,
}: StudyOverviewDashboardProps) {
  const { t, i18n } = useTranslation('study');
  const googleCalendar = useGoogleCalendarConnection();
  const emptyStateId = useId();
  const reviewCountId = useId();
  const reviewTimeId = useId();
  const lessonCountId = useId();
  const showEmptyState = reviewAvailableCount === 0 && !loading;
  const beginStudyDisabled = isStartingSession || showEmptyState;
  const lessonsAvailable = getLessonCount(overview);
  const reviewEmptyMessage = lessonsAvailable > 0 ? t('overview.noReviews') : t('overview.empty');
  const readiness = overview?.learningReadiness;
  const estimatedMinutes = estimateReviewMinutes(reviewAvailableCount);
  const reviewCountText = t('overview.reviewCount', { count: reviewAvailableCount });
  const reviewTimeText = getReviewTimeText(t, reviewAvailableCount, estimatedMinutes);
  const newCardCountText = t('overview.newCardCount', { count: lessonsAvailable });
  const wanikani = useKnownKanji().data?.wanikani;
  const nextLesson = googleCalendar.data?.nextLesson;
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const readinessBorderClass = getReadinessBorderClass(readiness?.recommendation);

  return {
    t,
    emptyStateId,
    reviewCountId,
    reviewTimeId,
    lessonCountId,
    showEmptyState,
    beginStudyDisabled,
    lessonsAvailable,
    reviewEmptyMessage,
    readiness,
    reviewCountText,
    reviewTimeText,
    newCardCountText,
    wanikani,
    nextLesson,
    locale,
    readinessBorderClass,
  };
}

const NextLesson = ({
  nextLesson,
  locale,
  t,
}: Pick<ReturnType<typeof useDashboardState>, 'nextLesson' | 'locale' | 't'>) =>
  nextLesson ? (
    <Link
      to="/app/study/time"
      className="study-console-next flex min-h-20 items-center gap-3 px-4 py-3 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-cyan"
    >
      <span className="study-console-next-icon grid size-10 shrink-0 place-items-center bg-cyan text-navy">
        <CalendarDays aria-hidden="true" className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold uppercase tracking-[0.1em] text-gray-500">
          {t('overview.nextLesson')}
        </span>
        <span className="block truncate font-bold text-navy">{nextLesson.title}</span>
      </span>
      <span className="shrink-0 text-right text-sm font-bold text-navy">
        <span className="block">{calendarDayLabel(new Date(nextLesson.startsAt), locale)}</span>
        <span className="block text-xs font-medium text-gray-500">
          {new Intl.DateTimeFormat(locale, {
            hour: 'numeric',
            minute: '2-digit',
          }).format(new Date(nextLesson.startsAt))}
        </span>
      </span>
    </Link>
  ) : null;

const ReadinessSummary = ({
  readiness,
  readinessBorderClass,
}: Pick<ReturnType<typeof useDashboardState>, 'readiness' | 'readinessBorderClass'>) =>
  readiness?.displayStatus && readiness.displaySummary ? (
    <div
      className={`study-console-readiness-summary border-l-4 ${readinessBorderClass}`}
      role="status"
    >
      <p className="font-bold text-navy">{readiness.displayStatus}</p>
      <p className="mt-0.5 text-sm text-gray-600">{readiness.displaySummary}</p>
    </div>
  ) : null;

const OverviewMasterySpread = ({ overview }: Pick<StudyOverviewDashboardProps, 'overview'>) =>
  overview?.masterySpread ? <MasterySpreadChart spread={overview.masterySpread} /> : null;

const WaniKaniLink = ({
  wanikani,
  t,
}: Pick<ReturnType<typeof useDashboardState>, 'wanikani' | 't'>) => (
  <a
    href="https://www.wanikani.com/subjects/review"
    target="_blank"
    rel="noreferrer"
    className="study-console-quick min-h-28 px-4 py-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#ee685a]"
  >
    <span className="study-console-quick-icon is-wanikani mb-2 grid size-8 place-items-center text-white">
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
);

const StudyOverviewDashboard = (props: StudyOverviewDashboardProps) => {
  const {
    overview,
    loading,
    error,
    onBeginReview,
    onBeginLesson,
    isStartingSession,
    reviewAvailableCount,
  } = props;
  const {
    t,
    emptyStateId,
    reviewCountId,
    reviewTimeId,
    lessonCountId,
    showEmptyState,
    beginStudyDisabled,
    lessonsAvailable,
    reviewEmptyMessage,
    readiness,
    reviewCountText,
    reviewTimeText,
    newCardCountText,
    wanikani,
    nextLesson,
    locale,
    readinessBorderClass,
  } = useDashboardState({ ...props, reviewAvailableCount });

  return (
    <div className="study-console ios-study-home space-y-7">
      <section>
        <div className="study-console-plan">
          <button
            type="button"
            onClick={onBeginReview}
            disabled={beginStudyDisabled}
            aria-label={t('overview.reviews')}
            aria-describedby={[reviewCountId, reviewTimeId, showEmptyState ? emptyStateId : null]
              .filter(Boolean)
              .join(' ')}
            className="study-console-review flex min-h-32 w-full items-center gap-5 px-5 py-5 text-left text-[#fbf5e0] transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-cyan disabled:cursor-not-allowed disabled:opacity-65 sm:px-6"
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
              className="study-console-play grid size-14 shrink-0 place-items-center rounded-full text-navy"
            >
              <Play className="ml-0.5 size-6 fill-current" />
            </span>
          </button>

          <ReadinessSummary readiness={readiness} readinessBorderClass={readinessBorderClass} />

          <div className="study-console-quick-grid grid grid-cols-2">
            <button
              type="button"
              onClick={() => onBeginLesson()}
              disabled={isStartingSession || lessonsAvailable === 0}
              aria-label={t('overview.lessons')}
              aria-describedby={lessonCountId}
              className="study-console-quick min-h-28 px-4 py-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-cyan disabled:cursor-not-allowed disabled:opacity-55"
            >
              <span className="study-console-quick-icon is-lessons mb-2 grid size-8 place-items-center text-white">
                <BookOpen aria-hidden="true" className="size-4" />
              </span>
              <span className="block font-bold text-navy">{t('piles.usualMix')}</span>
              <span id={lessonCountId} className="mt-0.5 block text-sm text-gray-600">
                {newCardCountText}
              </span>
            </button>

            <WaniKaniLink wanikani={wanikani} t={t} />
          </div>

          <NextLesson nextLesson={nextLesson} locale={locale} t={t} />
        </div>

        <p className="study-console-total mt-3 pr-1 text-right text-xs text-gray-500">
          {t('overview.totalCardCount', {
            count: getTotalCards(overview),
            formattedCount: new Intl.NumberFormat(locale).format(getTotalCards(overview)),
          })}
        </p>

        {showEmptyState ? (
          <p id={emptyStateId} className="study-console-empty-note mt-2 text-sm text-gray-600">
            {reviewEmptyMessage}
          </p>
        ) : null}
        {loading ? <p className="mt-2 text-gray-500">{t('overview.loading')}</p> : null}
        {error ? <p className="mt-2 text-red-600">{error.message}</p> : null}
      </section>

      <StudyPileShelf onBeginLesson={onBeginLesson} disabled={isStartingSession} />

      <nav
        aria-label={t('overview.studyTools')}
        className="study-console-tools hidden flex-wrap gap-2 sm:flex"
      >
        <Link to="/app/study/cards" className={STUDY_ACTION_CLASS}>
          {t('overview.cards')}
        </Link>
        <Link to="/app/study/daily-audio" className={STUDY_ACTION_CLASS}>
          {t('overview.dailyAudio')}
        </Link>
        <Link to="/app/study/settings" className={STUDY_ACTION_CLASS}>
          {t('overview.settings')}
        </Link>
      </nav>

      <OverviewMasterySpread overview={overview} />
    </div>
  );
};

export default StudyOverviewDashboard;
