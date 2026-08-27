import { ArrowLeft } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { AchievementBadgeCard } from '../components/study/StudyAchievementViews';
import {
  closestInProgressAchievements,
  recentEarnedAchievements,
} from '../components/study/achievementModel';
import useAchievements from '../hooks/useAchievements';

const StudyMilestonesPage = () => {
  const { t } = useTranslation('study');
  const { catalog, progress, loading, error, progressError, retry } = useAchievements();
  const [view, setView] = useState<'progress' | 'earned'>('progress');
  const inProgress = useMemo(
    () => (catalog ? closestInProgressAchievements(catalog, progress) : []),
    [catalog, progress]
  );
  const earned = useMemo(
    () => (catalog ? recentEarnedAchievements(catalog, progress, Number.MAX_SAFE_INTEGER) : []),
    [catalog, progress]
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex items-start gap-3">
          <Link
            to="/app/study"
            className="mt-1 grid size-10 place-items-center rounded-full border border-gray-300 bg-white text-navy hover:bg-gray-50"
            aria-label={t('milestones.back')}
          >
            <ArrowLeft aria-hidden="true" className="size-5" />
          </Link>
          <div>
            <p className="study-console-kicker">{t('achievements.kicker')}</p>
            <h1 className="text-4xl font-black text-[var(--retro-ink-strong)] sm:text-6xl">
              {t('achievements.heading')}
            </h1>
          </div>
        </div>
        <div
          className="achievement-view-toggle"
          role="group"
          aria-label={t('achievements.viewLabel')}
        >
          <button
            type="button"
            className={view === 'progress' ? 'is-active' : ''}
            aria-pressed={view === 'progress'}
            onClick={() => setView('progress')}
          >
            {t('achievements.inProgress')}
          </button>
          <button
            type="button"
            className={view === 'earned' ? 'is-active' : ''}
            aria-pressed={view === 'earned'}
            onClick={() => setView('earned')}
          >
            {t('achievements.earned')}
          </button>
        </div>
      </header>

      {loading ? (
        <p className="text-[var(--retro-ink-strong)]">{t('achievements.loading')}</p>
      ) : null}
      {!loading && error ? (
        <div className="border-2 border-navy/15 bg-white/70 p-6">
          <p>{t('achievements.error')}</p>
          <button type="button" className="btn-secondary mt-3" onClick={retry}>
            {t('achievements.retry')}
          </button>
        </div>
      ) : null}
      {!loading && catalog && progressError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-navy/15 bg-white/70 p-5">
          <p>{t('achievements.progressError')}</p>
          <button type="button" className="btn-secondary" onClick={retry}>
            {t('achievements.retry')}
          </button>
        </div>
      ) : null}

      {!loading && catalog && view === 'progress' ? (
        <section>
          <p className="max-w-2xl text-lg text-[color:rgba(17,51,92,0.72)]">
            {t('achievements.progressIntro')}
          </p>
          <div className="achievement-badge-grid mt-6">
            {inProgress.map((achievement) => (
              <AchievementBadgeCard key={achievement.id} achievement={achievement} />
            ))}
          </div>
        </section>
      ) : null}

      {!loading && catalog && view === 'earned' ? (
        <section>
          <p className="max-w-2xl text-lg text-[color:rgba(17,51,92,0.72)]">
            {t('achievements.earnedIntro')}
          </p>
          {earned.length > 0 ? (
            <div className="achievement-badge-grid mt-6">
              {earned.map((achievement) => (
                <AchievementBadgeCard key={achievement.id} achievement={achievement} />
              ))}
            </div>
          ) : (
            <p className="mt-6 text-[var(--retro-ink-strong)]">{t('achievements.noEarned')}</p>
          )}
        </section>
      ) : null}
    </div>
  );
};

export default StudyMilestonesPage;
