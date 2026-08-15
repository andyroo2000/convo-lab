import { CalendarRange, RefreshCw, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useWeeklyStudyRecap, type WeeklyRecapCategories } from '../../hooks/useWeeklyStudyRecap';
import formatDuration from '../../utils/studyTimeFormat';

const CATEGORIES: Array<{
  key: keyof WeeklyRecapCategories;
  color: string;
  labelKey: string;
}> = [
  { key: 'review', color: 'bg-blue-500', labelKey: 'time.totals.review' },
  { key: 'listen', color: 'bg-cyan-500', labelKey: 'time.totals.listen' },
  { key: 'create', color: 'bg-amber-500', labelKey: 'time.totals.create' },
  { key: 'immerse', color: 'bg-emerald-500', labelKey: 'time.totals.immerse' },
  { key: 'conversation', color: 'bg-violet-500', labelKey: 'time.totals.conversation' },
  { key: 'wanikani', color: 'bg-pink-500', labelKey: 'time.totals.wanikani' },
];

function formatRecall(rate: number | null, locale: string) {
  if (rate === null) return '—';
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(rate);
}

function signedDelta(current: number, previous: number) {
  const delta = current - previous;
  return delta > 0 ? `+${delta}` : `${delta}`;
}

const WeeklyStudyRecapCard = () => {
  const { i18n, t } = useTranslation(['study']);
  const recap = useWeeklyStudyRecap();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  if (recap.isLoading) {
    return (
      <section className="retro-paper-panel p-6" aria-labelledby="weekly-recap-title">
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
      <section className="retro-paper-panel p-6" aria-labelledby="weekly-recap-title">
        <p id="weekly-recap-title" role="alert" className="text-red-700">
          {t('time.weeklyRecap.error')}
        </p>
        <button type="button" className="btn-outline mt-3" onClick={() => recap.refetch()}>
          {t('time.weeklyRecap.retry')}
        </button>
      </section>
    );
  }

  const { week, previousWeek } = recap.data;
  const categoryTotal = Object.values(week.categories).reduce((sum, value) => sum + value, 0);
  const noActivity = week.totalMs === 0 && week.reviewCount === 0 && week.newCardsIntroduced === 0;
  const primaryCategory = CATEGORIES.reduce((best, category) =>
    week.categories[category.key] > week.categories[best.key] ? category : best
  );
  let headline =
    categoryTotal > 0
      ? t('time.weeklyRecap.headlines.categoryLed', { category: t(primaryCategory.labelKey) })
      : t('time.weeklyRecap.headlines.progress');
  if (week.activeDays >= 5) headline = t('time.weeklyRecap.headlines.steady');
  if (week.recallRate !== null && week.recallRate >= 0.9) {
    headline = t('time.weeklyRecap.headlines.strongRecall');
  }
  const period = `${new Date(week.startsAt).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
  })} – ${new Date(new Date(week.endsAt).getTime() - 1).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
  let timeChange = t('time.weeklyRecap.comparison.noChange');
  if (week.totalMs > 0 && previousWeek.totalMs === 0) {
    timeChange = t('time.weeklyRecap.comparison.newBaseline');
  } else if (previousWeek.totalMs > 0) {
    timeChange = t('time.weeklyRecap.comparison.percent', {
      value: signedDelta(
        Math.round(((week.totalMs - previousWeek.totalMs) / previousWeek.totalMs) * 100),
        0
      ),
    });
  }
  const recallChange =
    week.recallRate !== null && previousWeek.recallRate !== null
      ? t('time.weeklyRecap.comparison.points', {
          value: signedDelta(
            Math.round(week.recallRate * 100),
            Math.round(previousWeek.recallRate * 100)
          ),
        })
      : t('time.weeklyRecap.comparison.notAvailable');

  return (
    <section className="retro-paper-panel overflow-hidden" aria-labelledby="weekly-recap-title">
      <div className="border-b border-navy/10 bg-gradient-to-r from-violet-50 via-white to-cyan-50 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="retro-caps text-violet-700">{t('time.weeklyRecap.eyebrow')}</p>
            <h2 id="weekly-recap-title" className="retro-headline text-3xl text-navy">
              {t('time.weeklyRecap.title')}
            </h2>
            <p className="mt-1 text-sm font-bold text-gray-500">{period}</p>
          </div>
          <CalendarRange className="h-9 w-9 shrink-0 text-violet-600" aria-hidden="true" />
        </div>
      </div>

      {noActivity ? (
        <div className="p-8 text-center">
          <Sparkles className="mx-auto h-9 w-9 text-coral" aria-hidden="true" />
          <h3 className="mt-3 text-xl font-black text-navy">{t('time.weeklyRecap.emptyTitle')}</h3>
          <p className="mx-auto mt-2 max-w-xl text-gray-600">{t('time.weeklyRecap.emptyBody')}</p>
        </div>
      ) : (
        <div className="space-y-6 p-6">
          <div>
            <p className="retro-caps text-coral">{t('time.weeklyRecap.yourWeek')}</p>
            <h3 className="mt-1 text-2xl font-black text-navy">{headline}</h3>
          </div>

          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              [t('time.weeklyRecap.metrics.total'), formatDuration(week.totalMs)],
              [t('time.weeklyRecap.metrics.activeDays'), week.activeDays],
              [t('time.weeklyRecap.metrics.recall'), formatRecall(week.recallRate, locale)],
              [t('time.weeklyRecap.metrics.reviews'), week.reviewCount],
              [t('time.weeklyRecap.metrics.newCards'), week.newCardsIntroduced],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-navy/10 bg-white/70 p-4">
                <dt className="retro-caps text-gray-500">{label}</dt>
                <dd className="mt-1 text-2xl font-black text-navy">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
            <div className="rounded-xl border border-navy/10 bg-white/70 p-5">
              <h3 className="font-black text-navy">{t('time.weeklyRecap.categoryMix')}</h3>
              <div
                className="mt-4 flex h-4 overflow-hidden rounded-full bg-gray-100"
                role="img"
                aria-label={t('time.weeklyRecap.categoryMixLabel')}
              >
                {CATEGORIES.map((category) =>
                  week.categories[category.key] > 0 ? (
                    <span
                      key={category.key}
                      className={category.color}
                      style={{ width: `${(week.categories[category.key] / categoryTotal) * 100}%` }}
                      title={`${t(category.labelKey)}: ${formatDuration(week.categories[category.key])}`}
                    />
                  ) : null
                )}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {CATEGORIES.map((category) => (
                  <div
                    key={category.key}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="flex items-center gap-2 text-gray-600">
                      <span className={`h-2.5 w-2.5 rounded-full ${category.color}`} />
                      {t(category.labelKey)}
                    </span>
                    <strong className="text-navy">
                      {formatDuration(week.categories[category.key])}
                    </strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-navy p-5 text-cream">
              <p className="retro-caps text-cyan-200">{t('time.weeklyRecap.bestDay')}</p>
              <p className="mt-2 text-2xl font-black">
                {week.bestDay
                  ? new Date(`${week.bestDay.date}T12:00:00`).toLocaleDateString(locale, {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
                    })
                  : '—'}
              </p>
              <p className="mt-1 text-sm font-bold text-cyan-100">
                {week.bestDay
                  ? formatDuration(week.bestDay.totalMs)
                  : t('time.weeklyRecap.noBestDay')}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-navy/10 bg-cream/70 p-5">
            <h3 className="font-black text-navy">{t('time.weeklyRecap.comparison.title')}</h3>
            <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-5">
              {[
                [
                  t('time.weeklyRecap.metrics.total'),
                  timeChange,
                  formatDuration(previousWeek.totalMs),
                ],
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
              ].map(([label, change, previous]) => (
                <div key={label}>
                  <dt className="retro-caps text-gray-500">{label}</dt>
                  <dd className="mt-1 font-black text-navy">{change}</dd>
                  <dd className="text-xs text-gray-500">
                    {t('time.weeklyRecap.comparison.previous', { value: previous })}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </section>
  );
};

export default WeeklyStudyRecapCard;
