import { Check, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { StudyCardSummary } from '@languageflow/shared/src/types';
import type { StudySessionWrapUpSummary } from './studySessionWrapUpModel';
import { toDisplayText } from './studyTextUtils';
import { AchievementBadgeCard } from './StudyAchievementViews';
import type { PresentedAchievement } from './achievementModel';

interface StudySessionWrapUpProps {
  summary: StudySessionWrapUpSummary;
  caughtUp: boolean;
  achievements: PresentedAchievement[];
  isFinalizing: boolean;
  onPractice: (cards: StudyCardSummary[]) => void;
  onDone: () => void;
}

const cardLabel = (card: StudyCardSummary, fallback: string) =>
  toDisplayText(
    card.answer.expressionReading ??
      card.answer.expression ??
      card.prompt.cueText ??
      card.answer.restoredText ??
      card.prompt.clozeDisplayText ??
      fallback
  );

const cardMeaning = (card: StudyCardSummary) =>
  card.answer.meaning ?? card.prompt.cueMeaning ?? null;

const formatSeconds = (durationMs: number) =>
  `${Math.max(1, Math.round(durationMs / 1000)).toLocaleString()} sec`;

const StudySessionWrapUp = ({
  summary,
  caughtUp,
  achievements,
  isFinalizing,
  onPractice,
  onDone,
}: StudySessionWrapUpProps) => {
  const { t } = useTranslation('study');
  const fallbackCardLabel = t('wrapUp.cardFallback');
  const recall =
    summary.firstPassRecall === null
      ? '—'
      : summary.firstPassRecall.toLocaleString(undefined, {
          style: 'percent',
          maximumFractionDigits: 0,
        });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto py-4" data-testid="study-session-wrap-up">
      <div className="mx-auto flex max-w-xl flex-col gap-3 pb-6">
        <div className="text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-navy text-white shadow-sm">
            <Check className="h-8 w-8" aria-hidden="true" />
          </span>
          <h2 className="mt-3 text-3xl font-bold text-navy">{t('wrapUp.title')}</h2>
          <p className="mt-1 text-gray-600">
            {t(caughtUp ? 'wrapUp.description' : 'wrapUp.partialDescription')}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="app-surface p-4 text-center">
            <p className="text-3xl font-bold tabular-nums text-navy">{summary.reviewsCompleted}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
              {t('wrapUp.reviews')}
            </p>
          </div>
          <div className="app-surface p-4 text-center">
            <p className="text-3xl font-bold tabular-nums text-navy">{recall}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
              {t('wrapUp.recall')}
            </p>
          </div>
        </div>

        <section className="app-surface flex items-center gap-3 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
            <TrendingUp className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-gray-900">{t('wrapUp.stabilized')}</h3>
            {summary.stabilizedCards.length > 0 ? (
              <p className="truncate text-sm text-gray-500">
                {summary.stabilizedCards
                  .map((card) => cardLabel(card, fallbackCardLabel))
                  .join(' · ')}
              </p>
            ) : (
              <p className="text-sm text-gray-500">{t('wrapUp.noneStabilized')}</p>
            )}
          </div>
          <span className="text-2xl font-bold tabular-nums text-emerald-600">
            {summary.stabilizedCards.length}
          </span>
        </section>

        {summary.toughestCards.length > 0 ? (
          <section className="app-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold text-gray-900">{t('wrapUp.toughest')}</h3>
              <button
                type="button"
                onClick={() => onPractice(summary.toughestCards.map(({ card }) => card))}
                className="app-button-primary shrink-0"
              >
                {t('wrapUp.practice', { count: summary.toughestCards.length })}
              </button>
            </div>
            <div className="mt-2 divide-y divide-gray-100">
              {summary.toughestCards.map(({ card, durationMs, missCount }) => (
                <div
                  key={card.syncId ?? card.id}
                  className="flex min-h-11 items-center justify-between gap-4 py-2"
                >
                  <p className="min-w-0 truncate font-semibold text-gray-900">
                    {cardLabel(card, fallbackCardLabel)}
                    {cardMeaning(card) ? (
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        {cardMeaning(card)}
                      </span>
                    ) : null}
                  </p>
                  <p className="shrink-0 text-sm font-bold tabular-nums text-coral">
                    {[
                      missCount > 0 ? t('wrapUp.misses', { count: missCount }) : null,
                      formatSeconds(durationMs),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {achievements.length > 0 ? (
          <section className="app-surface p-4" data-testid="study-session-achievements">
            <h3 className="font-bold text-gray-900">{t('achievements.earnedThisSession')}</h3>
            <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
              {achievements.map((achievement, index) => (
                <AchievementBadgeCard
                  key={achievement.id}
                  achievement={achievement}
                  transitionName={index === 0 ? 'achievement-badge-flight' : undefined}
                  isNew
                  suppressShadow
                />
              ))}
            </div>
          </section>
        ) : null}

        <button
          type="button"
          onClick={onDone}
          disabled={isFinalizing}
          aria-busy={isFinalizing}
          className="app-button-primary mt-1 w-full disabled:cursor-wait disabled:opacity-70"
        >
          {t(isFinalizing ? 'wrapUp.finalizing' : 'wrapUp.done')}
        </button>
      </div>
    </div>
  );
};

export default StudySessionWrapUp;
