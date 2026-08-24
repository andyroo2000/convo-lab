import type { StudyMasteryLevel, StudyMasterySpread } from '@languageflow/shared/src/types';
import { useTranslation } from 'react-i18next';

import { STUDY_MASTERY_LEVELS } from './studyMastery';

interface MasterySpreadChartProps {
  spread: StudyMasterySpread;
}

const MASTERY_COLOR_CLASSES: Record<StudyMasteryLevel, string> = {
  apprentice: 'bg-[#e85d75]',
  guru: 'bg-[#8b5cf6]',
  master: 'bg-[#2563eb]',
  enlightened: 'bg-[#f59e0b]',
  burned: 'bg-[#22c55e]',
};

const masterySpreadEntries = (spread: StudyMasterySpread) =>
  STUDY_MASTERY_LEVELS.map((level) => ({ level, count: Math.max(0, spread[level]) }));

const MasterySpreadChart = ({ spread }: MasterySpreadChartProps) => {
  const { i18n, t } = useTranslation('study');
  const numberFormatter = new Intl.NumberFormat(i18n.resolvedLanguage);
  const entries = masterySpreadEntries(spread);
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  const entriesWithShare = entries.map((entry) => ({
    ...entry,
    share: total > 0 ? entry.count / total : 0,
  }));
  const summary = entriesWithShare
    .map(
      ({ level, share }) => `${t(`mastery.levels.${level}`)} ${String(Math.round(share * 100))}%`
    )
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
        {entriesWithShare.map(({ level, share }) => {
          const percentage = Math.round(share * 100);
          return (
            <div
              key={level}
              className={`grid min-w-0 place-items-center text-xs font-semibold text-white ${MASTERY_COLOR_CLASSES[level]}`}
              style={{ width: `${String(share * 100)}%` }}
            >
              {percentage >= 12 ? `${String(percentage)}%` : null}
            </div>
          );
        })}
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
        {entriesWithShare.map(({ level, count, share }) => (
          <div
            key={level}
            className="grid min-h-10 grid-cols-[minmax(0,1fr)_4rem_4rem] items-center gap-3 border-t border-navy/10 text-sm"
            role="row"
          >
            <span className="flex min-w-0 items-center gap-2 font-semibold text-navy" role="cell">
              <span
                className={`size-2 shrink-0 rounded-full ${MASTERY_COLOR_CLASSES[level]}`}
                aria-hidden="true"
              />
              {t(`mastery.levels.${level}`)}
            </span>
            <span className="text-right tabular-nums text-navy" role="cell">
              {numberFormatter.format(count)}
            </span>
            <span className="text-right tabular-nums text-gray-500" role="cell">
              {Math.round(share * 100)}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default MasterySpreadChart;
