import { Star } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import useAchievements from '../../hooks/useAchievements';
import {
  closestInProgressAchievements,
  recentEarnedAchievements,
  type AchievementCatalog,
  type AchievementProgress,
  type PresentedAchievement,
} from './achievementModel';

interface AchievementBadgeCardProps {
  achievement: PresentedAchievement;
  transitionName?: string;
  isNew?: boolean;
  suppressShadow?: boolean;
}

export const AchievementBadgeCard = ({
  achievement,
  transitionName,
  isNew = false,
  suppressShadow = false,
}: AchievementBadgeCardProps) => {
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
      className={`achievement-badge-card ${earned ? 'is-earned' : 'is-locked'} ${
        suppressShadow ? 'is-shadowless' : ''
      }`}
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
        style={
          transitionName ? ({ viewTransitionName: transitionName } as CSSProperties) : undefined
        }
      />
      {isNew ? <span className="achievement-badge-new">{t('achievements.new')}</span> : null}
      <div className="achievement-badge-caption">
        <h3>{tier.title}</h3>
        <p>{detail}</p>
      </div>
    </article>
  );
};

interface StudyAchievementAwardViewProps {
  achievements: PresentedAchievement[];
  currentIndex: number;
  onContinue: () => void;
}

const achievementStarColors = [
  'text-cyan',
  'text-coral',
  'text-emerald-500',
  'text-yellow-400',
  'text-purple-500',
  'text-pink-500',
  'text-blue-500',
  'text-orange-500',
];

const achievementPrefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const StudyAchievementAwardView = ({
  achievements,
  currentIndex,
  onContinue,
}: StudyAchievementAwardViewProps) => {
  const { t } = useTranslation('study');
  const achievement = achievements[currentIndex];
  const hasNext = currentIndex + 1 < achievements.length;
  const [animationKey, setAnimationKey] = useState(0);
  const [canContinue, setCanContinue] = useState(achievementPrefersReducedMotion);
  const [advancing, setAdvancing] = useState(false);
  const advanceTimeoutRef = useRef<number | null>(null);
  const nextAchievement = achievements[currentIndex + 1] ?? null;
  useEffect(() => {
    if (achievementPrefersReducedMotion()) {
      setCanContinue(true);
      return undefined;
    }
    setCanContinue(false);
    const timeoutId = window.setTimeout(() => setCanContinue(true), 4_800);
    return () => window.clearTimeout(timeoutId);
  }, [achievement.id, animationKey]);

  useEffect(
    () => () => {
      if (advanceTimeoutRef.current !== null) {
        window.clearTimeout(advanceTimeoutRef.current);
      }
    },
    []
  );

  if (!achievement) return null;

  const advance = () => {
    if (!hasNext || achievementPrefersReducedMotion()) {
      onContinue();
      return;
    }
    setAdvancing(true);
    advanceTimeoutRef.current = window.setTimeout(() => {
      onContinue();
      setAdvancing(false);
      advanceTimeoutRef.current = null;
    }, 560);
  };

  const awardPanel = (item: PresentedAchievement, incoming: boolean) => {
    const itemStandard = item.tier.assets.earned.png['256'];
    const itemRetina = item.tier.assets.earned.png['512'];
    return (
      <div className={`study-achievement-award-panel ${incoming ? 'is-incoming' : 'is-current'}`}>
        <div className="study-achievement-orbit" aria-hidden="true">
          <div className="study-achievement-orbit-ring" />
          <div className="study-achievement-stars">
            {achievementStarColors.map((color, index) => (
              <span
                key={color}
                className="study-achievement-star-position"
                style={{ '--study-star-index': index } as CSSProperties}
              >
                <Star className={`study-achievement-star size-5 fill-current ${color}`} />
              </span>
            ))}
          </div>
          <img
            src={itemStandard.path}
            srcSet={`${itemStandard.path} 1x, ${itemRetina.path} 2x`}
            alt=""
            className="study-achievement-award-art"
            style={
              !incoming && !hasNext
                ? ({ viewTransitionName: 'achievement-badge-flight' } as CSSProperties)
                : undefined
            }
          />
        </div>
        <p className="mt-3 text-sm font-bold uppercase tracking-[0.18em] text-coral">
          {t('achievements.earned')}
        </p>
        <h2 className="mt-2 text-4xl font-black text-navy">{item.tier.title}</h2>
        <p className="mt-2 max-w-md text-gray-600">{item.tier.earnedDescription}</p>
      </div>
    );
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto py-5 text-center"
      data-testid="study-achievement-award"
    >
      <div
        key={`${achievement.id}-${animationKey}`}
        className={`study-achievement-award-stage ${
          currentIndex > 0 ? 'is-subsequent' : ''
        } ${advancing ? 'is-advancing' : ''}`}
      >
        {awardPanel(achievement, false)}
        {nextAchievement ? awardPanel(nextAchievement, true) : null}
      </div>

      <div className="mt-8 flex min-h-20 flex-col items-center gap-2">
        <button
          type="button"
          onClick={advance}
          disabled={!canContinue}
          className={`rounded-xl bg-navy px-8 py-3 font-bold text-white transition hover:bg-navy/90 disabled:pointer-events-none ${
            canContinue ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {t(hasNext ? 'achievements.next' : 'achievements.continue')}
        </button>
        <button
          type="button"
          onClick={() => setAnimationKey((current) => current + 1)}
          className="text-sm font-bold text-navy hover:text-cyan-700 motion-reduce:hidden"
        >
          {t('achievements.replay')}
        </button>
      </div>
    </div>
  );
};

const AchievementSkeletons = () => (
  <div className="achievement-badge-row" aria-hidden="true">
    {[0, 1, 2].map((key) => (
      <div key={key} className="h-[190px] w-32 shrink-0 animate-pulse bg-navy/10" />
    ))}
  </div>
);

interface AchievementShelfProps {
  earnedAchievements: PresentedAchievement[];
  inProgressAchievements: PresentedAchievement[];
}

export const AchievementShelf = ({
  earnedAchievements,
  inProgressAchievements,
}: AchievementShelfProps) => {
  const { t } = useTranslation('study');

  return (
    <div className="achievement-badge-row">
      {earnedAchievements.map((achievement) => (
        <AchievementBadgeCard key={achievement.id} achievement={achievement} />
      ))}

      {inProgressAchievements.length > 0 ? (
        <div className="achievement-next-up" role="group" aria-label={t('achievements.nextUp')}>
          <div className="achievement-next-up-marker" aria-hidden="true">
            <span>{t('achievements.nextUp')}</span>
          </div>
          {inProgressAchievements.map((achievement) => (
            <AchievementBadgeCard key={achievement.id} achievement={achievement} />
          ))}
        </div>
      ) : null}

      {earnedAchievements.length === 0 && inProgressAchievements.length === 0 ? (
        <p className="text-sm text-[color:rgba(17,51,92,0.72)]">{t('achievements.noEarned')}</p>
      ) : null}
    </div>
  );
};

interface StudyAchievementSpotlightProps {
  initialCatalog?: AchievementCatalog | null;
  initialProgress?: AchievementProgress | null;
  landingAchievementId?: string | null;
  newAchievementIds?: string[];
}

export const StudyAchievementSpotlight = ({
  initialCatalog = null,
  initialProgress = null,
  landingAchievementId = null,
  newAchievementIds = [],
}: StudyAchievementSpotlightProps = {}) => {
  const { t } = useTranslation('study');
  const { catalog, progress, loading, error, progressError, retry } = useAchievements();
  const resolvedCatalog = initialCatalog ?? catalog;
  const resolvedProgress = initialProgress ?? progress;
  const earnedAchievements = resolvedCatalog
    ? recentEarnedAchievements(resolvedCatalog, resolvedProgress, Number.MAX_SAFE_INTEGER)
    : [];
  const inProgressAchievements = resolvedCatalog
    ? closestInProgressAchievements(resolvedCatalog, resolvedProgress)
    : [];

  return (
    <section className="achievement-spotlight" data-testid="study-recent-milestones">
      <div>
        <p className="study-console-kicker">{t('achievements.kicker')}</p>
        <h2 className="mt-1 text-3xl text-[var(--retro-ink-strong)]">
          {t('achievements.heading')}
        </h2>
      </div>

      {loading && !resolvedCatalog ? <AchievementSkeletons /> : null}
      {resolvedCatalog ? (
        <div className="achievement-badge-row">
          {earnedAchievements.map((achievement) => (
            <AchievementBadgeCard
              key={achievement.id}
              achievement={achievement}
              transitionName={
                achievement.id === landingAchievementId ? 'achievement-badge-flight' : undefined
              }
              isNew={newAchievementIds.includes(achievement.id)}
            />
          ))}
          {inProgressAchievements.length > 0 ? (
            <div className="achievement-next-up" role="group" aria-label={t('achievements.nextUp')}>
              <div className="achievement-next-up-marker" aria-hidden="true">
                <span>{t('achievements.nextUp')}</span>
              </div>
              {inProgressAchievements.map((achievement) => (
                <AchievementBadgeCard key={achievement.id} achievement={achievement} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {!loading && resolvedCatalog && progressError ? (
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
