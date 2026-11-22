import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import type { StudyOverview } from '@languageflow/shared/src/types';
import { useTranslation } from 'react-i18next';
import estimateReviewMinutes from '../../utils/studyTodayPresentation';
import DailyAudioPracticePage from '../../pages/DailyAudioPracticePage';
import StudyPileShelf from './StudyPileShelf';
import './studyNotebook.css';

interface StudyOverviewDashboardProps {
  overview: StudyOverview | undefined;
  reviewAvailableCount: number;
  loading: boolean;
  error: Error | null;
  onBeginReview: () => void;
  onBeginLesson: (pileId?: string) => void;
  isStartingSession: boolean;
}

const ReviewLeaf = ({
  count,
  desc,
  empty,
  disabled,
  start,
}: {
  count: number;
  desc: string;
  empty: boolean;
  disabled: boolean;
  start: () => void;
}) => {
  const { t } = useTranslation('study');
  const minutes = estimateReviewMinutes(count);
  return (
    <section className="study-leaf">
      <h2>{t('notebook.review')}</h2>
      <p id={`${desc}-count`} className="study-count">
        <strong>{count}</strong> {t('notebook.due', { count })}
      </p>
      <p id={`${desc}-estimate`} className="study-detail">
        {minutes
          ? t('overview.reviewMinutes', { count: minutes })
          : t('overview.reviewAllCaughtUp')}
      </p>
      <button
        className="study-action primary-leaf"
        type="button"
        onClick={start}
        aria-describedby={[
          `${desc}-count`,
          `${desc}-estimate`,
          ...(empty ? [`${desc}-empty`] : []),
        ].join(' ')}
        disabled={disabled}
      >
        {t('notebook.startReview')}
      </button>
      <Link className="leaf-link" to="/app/study/browse">
        {t('notebook.browse')} ›
      </Link>
    </section>
  );
};
function availableLessons(overview?: StudyOverview) {
  return overview?.newCardsAvailableToday ?? overview?.newCount ?? 0;
}
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
  const [choosingPile, setChoosingPile] = useState(false);
  const lessons = availableLessons(overview);
  const desc = useId();
  const empty = !reviewAvailableCount && !loading;
  return (
    <div className="study-notebook">
      <header className="study-dateline">
        <h1>{t('notebook.title')}</h1>
        <time>
          {new Intl.DateTimeFormat(i18n.language, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }).format(new Date())}
        </time>
      </header>
      <div className="study-spread">
        <ReviewLeaf
          count={reviewAvailableCount}
          desc={desc}
          empty={empty}
          disabled={isStartingSession || empty}
          start={onBeginReview}
        />
        <section className="study-leaf">
          <h2>{t('notebook.learn')}</h2>
          <p className="study-count">
            <strong>{lessons}</strong> {t('notebook.newCards', { count: lessons })}
          </p>
          <p className="study-detail">{t('piles.usualMix')}</p>
          <button
            className="study-action"
            type="button"
            onClick={() => onBeginLesson()}
            disabled={isStartingSession || !lessons}
          >
            {t('notebook.startLesson')}
          </button>
          <button
            className="leaf-link"
            type="button"
            aria-expanded={choosingPile}
            onClick={() => setChoosingPile(!choosingPile)}
          >
            {t('notebook.choosePile')} ›
          </button>
        </section>
      </div>
      {choosingPile && (
        <StudyPileShelf onBeginLesson={onBeginLesson} disabled={isStartingSession} />
      )}
      {empty && <p id={`${desc}-empty`}>{t(lessons ? 'overview.noReviews' : 'overview.empty')}</p>}
      {loading && <p role="status">{t('overview.loading')}</p>}
      {error && <p role="alert">{error.message}</p>}
      <DailyAudioPracticePage />
    </div>
  );
};
export default StudyOverviewDashboard;
