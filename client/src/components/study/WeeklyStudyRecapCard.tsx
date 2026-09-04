import { CalendarRange, RefreshCw } from 'lucide-react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import STUDY_TIME_CATEGORIES from '../../data/studyTimeCategories';
import { useWeeklyStudyRecap } from '../../hooks/useWeeklyStudyRecap';
import type { WeeklyStudyRecap } from '../../hooks/useWeeklyStudyRecap';
import formatDuration from '../../utils/studyTimeFormat';

function formatRecall(rate: number | null, locale: string) {
  if (rate === null) return '—';
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(rate);
}

function signedDelta(current: number, previous: number) {
  const delta = current - previous;
  return delta > 0 ? `+${delta}` : `${delta}`;
}

type CurrentWeek = WeeklyStudyRecap['week'];
type PreviousWeek = WeeklyStudyRecap['previousWeek'];

function hasNoActivity(week: CurrentWeek) {
  if (week.totalMs !== 0) return false;
  if (week.reviewCount !== 0) return false;
  return week.newCardsIntroduced === 0;
}

function primaryStudyCategory(week: CurrentWeek) {
  return STUDY_TIME_CATEGORIES.reduce((best, category) =>
    week.categories[category.key] > week.categories[best.key] ? category : best
  );
}

function weeklyHeadline(week: CurrentWeek, categoryTotal: number, t: TFunction<'study'>) {
  if (week.recallRate !== null && week.recallRate >= 0.9) {
    return t('time.weeklyRecap.headlines.strongRecall');
  }
  if (week.activeDays >= 5) return t('time.weeklyRecap.headlines.steady');
  if (categoryTotal > 0) {
    return t('time.weeklyRecap.headlines.categoryLed', {
      category: t(primaryStudyCategory(week).labelKey),
    });
  }
  return t('time.weeklyRecap.headlines.progress');
}

function weeklyPeriod(week: CurrentWeek, locale: string) {
  const start = new Date(week.startsAt).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
  });
  const end = new Date(new Date(week.endsAt).getTime() - 1).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${start} – ${end}`;
}

function weeklyTimeChange(week: CurrentWeek, previousWeek: PreviousWeek, t: TFunction<'study'>) {
  if (week.totalMs > 0 && previousWeek.totalMs === 0) {
    return t('time.weeklyRecap.comparison.newBaseline');
  }
  if (previousWeek.totalMs === 0) return t('time.weeklyRecap.comparison.noChange');
  return t('time.weeklyRecap.comparison.percent', {
    value: signedDelta(
      Math.round(((week.totalMs - previousWeek.totalMs) / previousWeek.totalMs) * 100),
      0
    ),
  });
}

function weeklyRecallChange(week: CurrentWeek, previousWeek: PreviousWeek, t: TFunction<'study'>) {
  if (week.recallRate === null) return t('time.weeklyRecap.comparison.notAvailable');
  if (previousWeek.recallRate === null) return t('time.weeklyRecap.comparison.notAvailable');
  return t('time.weeklyRecap.comparison.points', {
    value: signedDelta(
      Math.round(week.recallRate * 100),
      Math.round(previousWeek.recallRate * 100)
    ),
  });
}

const WeeklyRecapHeader = ({ period }: { period: string }) => {
  const { t } = useTranslation(['study']);
  return (
    <div className="border-b border-gray-200 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {t('time.weeklyRecap.eyebrow')}
          </p>
          <h2 id="weekly-recap-title" className="text-xl font-bold text-navy sm:text-2xl">
            {t('time.weeklyRecap.title')}
          </h2>
          <p className="mt-1 text-sm font-bold text-gray-500">{period}</p>
        </div>
        <CalendarRange className="h-9 w-9 shrink-0 text-violet-600" aria-hidden="true" />
      </div>
    </div>
  );
};

const WeeklyRecapMetrics = ({ week, locale }: { week: CurrentWeek; locale: string }) => {
  const { t } = useTranslation(['study']);
  const metrics = [
    [t('time.weeklyRecap.metrics.total'), formatDuration(week.totalMs)],
    [t('time.weeklyRecap.metrics.activeDays'), week.activeDays],
    [t('time.weeklyRecap.metrics.recall'), formatRecall(week.recallRate, locale)],
    [t('time.weeklyRecap.metrics.reviews'), week.reviewCount],
    [t('time.weeklyRecap.metrics.newCards'), week.newCardsIntroduced],
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {metrics.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
          <dd className="mt-1 text-2xl font-black text-navy">{value}</dd>
        </div>
      ))}
    </dl>
  );
};

const WeeklyRecapCategoryMix = ({
  categoryTotal,
  week,
}: {
  categoryTotal: number;
  week: CurrentWeek;
}) => {
  const { t } = useTranslation(['study']);
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
      <h3 className="font-black text-navy">{t('time.weeklyRecap.categoryMix')}</h3>
      <div
        className="mt-4 flex h-4 overflow-hidden rounded-full bg-gray-100"
        role="img"
        aria-label={t('time.weeklyRecap.categoryMixLabel')}
      >
        {STUDY_TIME_CATEGORIES.map((category) =>
          week.categories[category.key] > 0 ? (
            <span
              key={category.key}
              className={category.barColor}
              style={{ width: `${(week.categories[category.key] / categoryTotal) * 100}%` }}
              title={`${t(category.labelKey)}: ${formatDuration(week.categories[category.key])}`}
            />
          ) : null
        )}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {STUDY_TIME_CATEGORIES.map((category) => (
          <div key={category.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-gray-600">
              <span className={`h-2.5 w-2.5 rounded-full ${category.barColor}`} />
              {t(category.labelKey)}
            </span>
            <strong className="text-navy">{formatDuration(week.categories[category.key])}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

const WeeklyRecapBestDay = ({ locale, week }: { locale: string; week: CurrentWeek }) => {
  const { t } = useTranslation(['study']);
  const bestDayLabel = week.bestDay
    ? new Date(`${week.bestDay.date}T12:00:00`).toLocaleDateString(locale, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      })
    : '—';
  const bestDayDuration = week.bestDay
    ? formatDuration(week.bestDay.totalMs)
    : t('time.weeklyRecap.noBestDay');
  return (
    <div className="rounded-xl bg-navy p-5 text-cream">
      <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">
        {t('time.weeklyRecap.bestDay')}
      </p>
      <p className="mt-2 text-2xl font-black">{bestDayLabel}</p>
      <p className="mt-1 text-sm font-bold text-cyan-100">{bestDayDuration}</p>
    </div>
  );
};

interface WeeklyRecapComparisonProps {
  locale: string;
  previousWeek: PreviousWeek;
  recallChange: string;
  timeChange: string;
  week: CurrentWeek;
}

const WeeklyRecapComparison = ({
  locale,
  previousWeek,
  recallChange,
  timeChange,
  week,
}: WeeklyRecapComparisonProps) => {
  const { t } = useTranslation(['study']);
  const comparisons = [
    [t('time.weeklyRecap.metrics.total'), timeChange, formatDuration(previousWeek.totalMs)],
    [
      t('time.weeklyRecap.metrics.activeDays'),
      signedDelta(week.activeDays, previousWeek.activeDays),
      previousWeek.activeDays,
    ],
    [
      t('time.weeklyRecap.metrics.recall'),
      recallChange,
      formatRecall(previousWeek.recallRate, locale),
    ],
    [
      t('time.weeklyRecap.metrics.reviews'),
      signedDelta(week.reviewCount, previousWeek.reviewCount),
      previousWeek.reviewCount,
    ],
    [
      t('time.weeklyRecap.metrics.newCards'),
      signedDelta(week.newCardsIntroduced, previousWeek.newCardsIntroduced),
      previousWeek.newCardsIntroduced,
    ],
  ];
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
      <h3 className="font-black text-navy">{t('time.weeklyRecap.comparison.title')}</h3>
      <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {comparisons.map(([label, change, previous]) => (
          <div key={label}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
            <dd className="mt-1 font-black text-navy">{change}</dd>
            <dd className="text-xs text-gray-500">
              {t('time.weeklyRecap.comparison.previous', { value: previous })}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

interface WeeklyRecapBodyProps extends WeeklyRecapComparisonProps {
  categoryTotal: number;
  headline: string;
  noActivity: boolean;
}

const WeeklyRecapBody = ({
  categoryTotal,
  headline,
  locale,
  noActivity,
  previousWeek,
  recallChange,
  timeChange,
  week,
}: WeeklyRecapBodyProps) => {
  const { t } = useTranslation(['study']);
  if (noActivity) {
    return (
      <div className="p-6 text-center sm:p-8">
        <h3 className="text-lg font-semibold text-navy">{t('time.weeklyRecap.emptyTitle')}</h3>
        <p className="mx-auto mt-2 max-w-xl text-gray-600">{t('time.weeklyRecap.emptyBody')}</p>
      </div>
    );
  }
  return (
    <div className="space-y-6 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {t('time.weeklyRecap.yourWeek')}
        </p>
        <h3 className="mt-1 text-xl font-bold text-navy">{headline}</h3>
      </div>
      <WeeklyRecapMetrics week={week} locale={locale} />
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <WeeklyRecapCategoryMix week={week} categoryTotal={categoryTotal} />
        <WeeklyRecapBestDay week={week} locale={locale} />
      </div>
      <WeeklyRecapComparison
        locale={locale}
        previousWeek={previousWeek}
        recallChange={recallChange}
        timeChange={timeChange}
        week={week}
      />
    </div>
  );
};

const WeeklyStudyRecapCard = () => {
  const { i18n, t } = useTranslation(['study']);
  const recap = useWeeklyStudyRecap();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  if (recap.isLoading) {
    return (
      <section className="card app-surface p-6" aria-labelledby="weekly-recap-title">
        <h2 id="weekly-recap-title" className="sr-only">
          {t('time.weeklyRecap.title')}
        </h2>
        <div role="status" className="flex items-center gap-3 text-gray-600">
          <RefreshCw className="h-5 w-5 animate-spin" aria-hidden="true" />
          {t('time.weeklyRecap.loading')}
        </div>
      </section>
    );
  }

  if (recap.isError || !recap.data) {
    return (
      <section className="card app-surface p-6" aria-labelledby="weekly-recap-title">
        <p id="weekly-recap-title" role="alert" className="text-red-700">
          {t('time.weeklyRecap.error')}
        </p>
        <button type="button" className="app-button-secondary mt-3" onClick={() => recap.refetch()}>
          {t('time.weeklyRecap.retry')}
        </button>
      </section>
    );
  }

  const { week, previousWeek } = recap.data;
  const categoryTotal = Object.values(week.categories).reduce((sum, value) => sum + value, 0);
  const noActivity = hasNoActivity(week);
  const headline = weeklyHeadline(week, categoryTotal, t);
  const period = weeklyPeriod(week, locale);
  const timeChange = weeklyTimeChange(week, previousWeek, t);
  const recallChange = weeklyRecallChange(week, previousWeek, t);

  return (
    <section className="card app-surface overflow-hidden" aria-labelledby="weekly-recap-title">
      <WeeklyRecapHeader period={period} />
      <WeeklyRecapBody
        categoryTotal={categoryTotal}
        headline={headline}
        locale={locale}
        noActivity={noActivity}
        previousWeek={previousWeek}
        recallChange={recallChange}
        timeChange={timeChange}
        week={week}
      />
    </section>
  );
};

export default WeeklyStudyRecapCard;
