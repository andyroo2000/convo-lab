import { useMemo } from 'react';
import type { StudyMasterySpread } from '@languageflow/shared/src/types';
import { useTranslation } from 'react-i18next';

import { STUDY_MASTERY_LEVELS } from './studyMastery';

interface MasterySpreadChartProps {
  spread: StudyMasterySpread;
}

const masterySpreadEntries = (spread: StudyMasterySpread) =>
  STUDY_MASTERY_LEVELS.map((level) => ({ level, count: Math.max(0, spread[level]) }));

const allocateWholePercentages = (shares: number[]) => {
  if (shares.every((share) => share === 0)) return shares.map(() => 0);

  const exactPercentages = shares.map((share) => share * 100);
  const percentages = exactPercentages.map(Math.floor);
  const remaining = 100 - percentages.reduce((sum, percentage) => sum + percentage, 0);
  const remainderOrder = exactPercentages
    .map((percentage, index) => ({ index, remainder: percentage - Math.floor(percentage) }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);

  remainderOrder.slice(0, remaining).forEach(({ index }) => {
    percentages[index] = (percentages[index] ?? 0) + 1;
  });
  return percentages;
};

const MasterySpreadChart = ({ spread }: MasterySpreadChartProps) => {
  const { i18n, t } = useTranslation('study');
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.resolvedLanguage),
    [i18n.resolvedLanguage]
  );
  const entries = masterySpreadEntries(spread);
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  const shares = entries.map((entry) => (total > 0 ? entry.count / total : 0));
  const percentages = allocateWholePercentages(shares);
  const entriesWithShare = entries.map((entry, index) => ({
    ...entry,
    share: shares[index] ?? 0,
    percentage: percentages[index] ?? 0,
  }));
  const summary = entriesWithShare
    .map(({ level, percentage }) => `${t(`mastery.levels.${level}`)} ${String(percentage)}%`)
    .join(', ');

  return (
    <section className="card retro-paper-panel" aria-labelledby="mastery-spread-title">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p
          id="mastery-spread-title"
          className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500"
        >
          {t('mastery.title')}
        </p>
        <p className="text-sm tabular-nums text-gray-500">{t('mastery.total', { count: total })}</p>
      </div>

      <div
        className="mt-4 flex h-8 overflow-hidden rounded-lg bg-navy/10"
        role="img"
        aria-label={`${t('mastery.title')}: ${summary}`}
      >
        {entriesWithShare.map(({ level, percentage, share }) => (
          <div
            key={level}
            className="mastery-stage-color grid min-w-0 place-items-center bg-[var(--mastery-stage-color)] text-xs font-semibold text-white"
            data-level={level}
            style={{ width: `${String(share * 100)}%` }}
          >
            {percentage >= 12 ? `${String(percentage)}%` : null}
          </div>
        ))}
      </div>

      <div className="mt-4" role="table" aria-label={t('mastery.details')}>
        <div
          className="grid grid-cols-[minmax(0,1fr)_4rem_4rem] gap-3 pb-2 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-gray-500"
          role="row"
        >
          <span role="columnheader">{t('mastery.stage')}</span>
          <span className="text-right" role="columnheader">
            {t('mastery.cards')}
          </span>
          <span className="text-right" role="columnheader">
            {t('mastery.share')}
          </span>
        </div>
        {entriesWithShare.map(({ level, count, percentage }) => (
          <div
            key={level}
            className="grid min-h-10 grid-cols-[minmax(0,1fr)_4rem_4rem] items-center gap-3 border-t border-navy/10 text-sm"
            role="row"
          >
            <span className="flex min-w-0 items-center gap-2 font-semibold text-navy" role="cell">
              <span
                className="mastery-stage-color size-2 shrink-0 rounded-full bg-[var(--mastery-stage-color)]"
                data-level={level}
                aria-hidden="true"
              />
              {t(`mastery.levels.${level}`)}
            </span>
            <span className="text-right tabular-nums text-navy" role="cell">
              {numberFormatter.format(count)}
            </span>
            <span className="text-right tabular-nums text-gray-500" role="cell">
              {percentage}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default MasterySpreadChart;
