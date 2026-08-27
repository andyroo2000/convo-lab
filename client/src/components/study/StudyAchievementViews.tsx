import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import useAchievements from '../../hooks/useAchievements';
import { recentEarnedAchievements, type PresentedAchievement } from './achievementModel';

interface AchievementBadgeCardProps {
  achievement: PresentedAchievement;
}

export const AchievementBadgeCard = ({ achievement }: AchievementBadgeCardProps) => {
  const { t, i18n } = useTranslation('study');
  const { tier, family, earned, remaining } = achievement;
  const state = earned ? 'earned' : 'locked';
  const standard = tier.assets[state].png['256'];
  const retina = tier.assets[state].png['512'];
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const unit = t(`achievements.units.${family.unit}`, {
    count: earned ? tier.threshold : (remaining ?? tier.threshold),
    defaultValue: family.unit,
  });
  let detail = tier.earnedDescription;
  if (!earned && remaining === null) {
    detail = t('achievements.startWith', {
      count: tier.threshold,
      formattedCount: new Intl.NumberFormat(locale).format(tier.threshold),
      unit,
    });
  } else if (!earned && remaining !== null) {
    detail = t('achievements.more', {
      count: remaining,
      formattedCount: new Intl.NumberFormat(locale).format(remaining),
      unit,
    });
  }

  return (
    <article
      className={`achievement-badge-card ${earned ? 'is-earned' : 'is-locked'}`}
      data-testid={`achievement-${achievement.id}`}
    >
      <img
        src={standard.path}
        srcSet={`${standard.path} 1x, ${retina.path} 2x`}
        width={128}
        height={128}
        loading="lazy"
        alt={tier.description}
        className="achievement-badge-art block size-32"
      />
      <div className="achievement-badge-caption">
        <h3>{tier.title}</h3>
        <p>{detail}</p>
      </div>
    </article>
  );
};

const AchievementSkeletons = () => (
  <div className="achievement-badge-row" aria-hidden="true">
    {[0, 1, 2].map((key) => (
      <div key={key} className="h-[190px] w-32 shrink-0 animate-pulse bg-navy/10" />
    ))}
  </div>
);

export const StudyAchievementSpotlight = () => {
  const { t } = useTranslation('study');
  const { catalog, progress, loading, error, progressError, retry } = useAchievements();
  const recentAchievements = catalog ? recentEarnedAchievements(catalog, progress) : [];

  return (
    <section className="achievement-spotlight" data-testid="study-recent-milestones">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="study-console-kicker">{t('achievements.kicker')}</p>
          <h2 className="mt-1 text-3xl text-[var(--retro-ink-strong)]">
            {t('achievements.heading')}
          </h2>
        </div>
        <Link
          to="/app/study/milestones"
          aria-label={t('milestones.recent')}
          className="inline-flex min-h-11 items-center gap-1 px-2 font-bold text-[var(--retro-ink-strong)] hover:text-cyan-700"
        >
          {t('achievements.viewAll')}
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      </div>

      {loading ? <AchievementSkeletons /> : null}
      {!loading && catalog && (!progressError || progress) ? (
        <div className="achievement-badge-row">
          {recentAchievements.map((achievement) => (
            <AchievementBadgeCard key={achievement.id} achievement={achievement} />
          ))}
          {recentAchievements.length === 0 ? (
            <p className="text-sm text-[color:rgba(17,51,92,0.72)]">{t('achievements.noEarned')}</p>
          ) : null}
        </div>
      ) : null}
      {!loading && catalog && progressError ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-2 border-navy/15 bg-cream/80 p-4 text-sm text-[var(--retro-ink-strong)]">
          <p>{t('achievements.progressError')}</p>
          <button type="button" onClick={retry} className="btn-secondary">
            {t('achievements.retry')}
          </button>
        </div>
      ) : null}
      {!loading && error ? (
        <div className="mt-4 border-2 border-[rgba(17,51,92,0.15)] bg-cream/80 p-5 text-[var(--retro-ink-strong)]">
          <p>{t('achievements.error')}</p>
          <button type="button" onClick={retry} className="btn-secondary mt-3">
            {t('achievements.retry')}
          </button>
        </div>
      ) : null}
    </section>
  );
};
