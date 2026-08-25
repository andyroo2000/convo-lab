import { ChevronRight, Star } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import {
  getStudyMilestoneDefinition,
  type StudyMilestoneAward,
  type StudyMilestoneDefinition,
} from './studyMilestoneModel';

interface StudyMilestoneBadgeProps {
  definition: StudyMilestoneDefinition;
  earned: boolean;
}

export const StudyMilestoneBadge = ({ definition, earned }: StudyMilestoneBadgeProps) => (
  <span
    aria-hidden="true"
    className={`grid size-16 shrink-0 place-items-center rounded-[1.15rem] border-[5px] font-mono text-xl font-black ${
      earned ? 'border-cyan/20 bg-navy text-cream' : 'border-navy/5 bg-navy/10 text-gray-500'
    }`}
  >
    {definition.badgeText}
  </span>
);

interface StudyRecentMilestonesProps {
  awards: StudyMilestoneAward[];
  title?: string;
  className?: string;
}

export const StudyRecentMilestones = ({
  awards,
  title,
  className = '',
}: StudyRecentMilestonesProps) => {
  const { t } = useTranslation('study');
  const visibleAwards = awards.slice(0, 3);
  if (visibleAwards.length === 0) return null;

  return (
    <Link
      to="/app/study/milestones"
      className={`block rounded-[1.35rem] border-2 border-navy/10 bg-white/80 p-4 shadow-[0_8px_24px_rgba(17,51,92,0.08)] transition hover:border-cyan/40 hover:bg-white ${className}`}
      data-testid="study-recent-milestones"
    >
      <span className="flex items-center justify-between gap-3">
        <span className="font-bold text-navy">{title ?? t('milestones.recent')}</span>
        <ChevronRight aria-hidden="true" className="size-4 text-gray-400" />
      </span>
      <span className="mt-3 grid grid-cols-3 gap-3">
        {visibleAwards.map((award) => {
          const definition = getStudyMilestoneDefinition(award.id);
          return (
            <span key={award.id} className="flex min-w-0 flex-col items-center gap-2 text-center">
              <StudyMilestoneBadge definition={definition} earned />
              <span className="text-xs font-bold leading-tight text-navy">
                {t(definition.titleKey)}
              </span>
            </span>
          );
        })}
      </span>
    </Link>
  );
};

interface StudyMilestoneAwardViewProps {
  award: StudyMilestoneAward;
  onContinue: () => void;
}

const starColors = [
  'text-cyan',
  'text-coral',
  'text-emerald-500',
  'text-yellow-400',
  'text-purple-500',
  'text-pink-500',
  'text-blue-500',
  'text-orange-500',
];

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const StudyMilestoneAwardView = ({ award, onContinue }: StudyMilestoneAwardViewProps) => {
  const { t } = useTranslation('study');
  const definition = getStudyMilestoneDefinition(award.id);
  const [animationKey, setAnimationKey] = useState(0);
  const [canContinue, setCanContinue] = useState(prefersReducedMotion);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setCanContinue(true);
      return undefined;
    }
    setCanContinue(false);
    const timeoutId = window.setTimeout(() => setCanContinue(true), 4_800);
    return () => window.clearTimeout(timeoutId);
  }, [animationKey]);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto py-5 text-center"
      data-testid="study-milestone-award"
    >
      <div key={animationKey} className="study-milestone-orbit" aria-hidden="true">
        <div className="study-milestone-orbit-ring" />
        <div className="study-milestone-stars">
          {starColors.map((color, index) => (
            <span
              key={color}
              className="study-milestone-star-position"
              style={{ '--study-star-index': index } as CSSProperties}
            >
              <Star className={`study-milestone-star size-5 fill-current ${color}`} />
            </span>
          ))}
        </div>
        <div className="study-milestone-award-badge">{definition.badgeText}</div>
      </div>

      <h2 className="mt-3 text-4xl font-black text-navy">{t(definition.titleKey)}</h2>
      <p className="mt-2 max-w-md text-gray-600">{t(definition.detailKey)}</p>

      <div className="mt-8 flex min-h-20 flex-col items-center gap-2">
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className={`rounded-xl bg-navy px-8 py-3 font-bold text-white transition hover:bg-navy/90 disabled:pointer-events-none ${
            canContinue ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {t('milestones.continue')}
        </button>
        <button
          type="button"
          onClick={() => setAnimationKey((current) => current + 1)}
          className="text-sm font-bold text-navy hover:text-cyan-700 motion-reduce:hidden"
        >
          {t('milestones.replay')}
        </button>
      </div>
    </div>
  );
};

interface StudyMilestoneListProps {
  title: string;
  definitions: StudyMilestoneDefinition[];
  earned: boolean;
}

export const StudyMilestoneList = ({ title, definitions, earned }: StudyMilestoneListProps) => {
  const { t } = useTranslation('study');
  if (definitions.length === 0) return null;

  return (
    <section>
      <h2 className="text-2xl font-black text-navy">{title}</h2>
      <div className="mt-3 space-y-3">
        {definitions.map((definition) => (
          <div
            key={definition.id}
            className={`flex items-center gap-4 rounded-[1.35rem] border-2 border-navy/10 p-4 shadow-sm ${
              earned ? 'bg-white/85' : 'bg-white/50'
            }`}
          >
            <StudyMilestoneBadge definition={definition} earned={earned} />
            <div>
              <h3 className="font-bold text-navy">{t(definition.titleKey)}</h3>
              <p className="mt-1 text-sm text-gray-600">{t(definition.detailKey)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
