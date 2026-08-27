import { ArrowLeft } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { AchievementBadgeCard } from '../components/study/StudyAchievementViews';
import {
  allPresentedAchievements,
  featuredAchievements,
} from '../components/study/achievementModel';
import useAchievements from '../hooks/useAchievements';

const StudyMilestonesPage = () => {
  const { t, i18n } = useTranslation('study');
  const { catalog, progress, loading, error, progressError, retry } = useAchievements();
  const [view, setView] = useState<'progress' | 'all'>('progress');
  const featured = useMemo(
    () => (catalog ? featuredAchievements(catalog, progress) : []),
    [catalog, progress]
  );
  const all = useMemo(
    () => (catalog ? allPresentedAchievements(catalog, progress) : []),
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
            className={view === 'all' ? 'is-active' : ''}
            aria-pressed={view === 'all'}
            onClick={() => setView('all')}
          >
            {t('achievements.allBadges')}
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
            {featured.map((achievement) => (
              <AchievementBadgeCard key={achievement.id} achievement={achievement} />
            ))}
          </div>
        </section>
      ) : null}

      {!loading && catalog && view === 'all'
        ? catalog.families.map((family) => (
            <section key={family.key}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-3xl text-[var(--retro-ink-strong)]">{family.title}</h2>
                <p className="text-sm font-bold uppercase tracking-[0.12em] text-coral">
                  {t('achievements.familyProgress', {
                    current: new Intl.NumberFormat(i18n.resolvedLanguage ?? i18n.language).format(
                      progress?.metricValues[family.metricKey] ?? 0
                    ),
                    unit: t(`achievements.units.${family.unit}`, {
                      count: progress?.metricValues[family.metricKey] ?? 0,
                      defaultValue: family.unit,
                    }),
                  })}
                </p>
              </div>
              <div className="achievement-badge-grid mt-4">
                {all
                  .filter((achievement) => achievement.family.key === family.key)
                  .map((achievement) => (
                    <AchievementBadgeCard key={achievement.id} achievement={achievement} />
                  ))}
              </div>
            </section>
          ))
        : null}
    </div>
  );
};

export default StudyMilestonesPage;
