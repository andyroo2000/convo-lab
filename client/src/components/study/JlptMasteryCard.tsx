import type { ReactNode } from 'react';
import { BookOpenCheck, RefreshCw } from 'lucide-react';
import type { StudyJlptMasteryMetric } from '@languageflow/shared/src/types';
import { useTranslation } from 'react-i18next';

import { useStudyOverview } from '../../hooks/useStudy';

interface MasteryMetricProps {
  label: string;
  metric: StudyJlptMasteryMetric;
  tone: 'navy' | 'coral';
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

const MasteryMetric = ({ label, metric, tone }: MasteryMetricProps) => {
  const { t } = useTranslation('study');
  const total = Math.max(0, metric.total);
  const matched = clamp(metric.matched ?? metric.covered, 0, total);
  const known = metric.known == null ? undefined : clamp(metric.known, 0, matched);
  const masteryPercent = clamp(metric.masteryPercent, 0, 100);
  const barColor = tone === 'navy' ? 'bg-navy' : 'bg-coral';

  return (
    <article className="rounded-2xl border border-navy/10 bg-white/75 p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-lg font-black text-navy">{label}</h3>
        <p className="font-mono text-3xl font-black text-navy">{masteryPercent}%</p>
      </div>

      <div
        className="mt-3 h-3 overflow-hidden rounded-full bg-navy/10"
        role="progressbar"
        aria-label={t('time.jlptMastery.progressLabel', { category: label })}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={masteryPercent}
      >
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${masteryPercent}%` }}
        />
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        {known !== undefined ? (
          <div className="flex items-center justify-between gap-4">
            <dt className="font-semibold text-gray-600">{t('time.jlptMastery.knownLabel')}</dt>
            <dd className="font-mono font-black text-navy">
              {t('time.jlptMastery.count', { value: known, total })}
            </dd>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-4">
          <dt className="font-semibold text-gray-600">{t('time.jlptMastery.matchedLabel')}</dt>
          <dd className="font-mono font-black text-navy">
            {t('time.jlptMastery.count', { value: matched, total })}
          </dd>
        </div>
      </dl>
    </article>
  );
};

const JlptMasteryCard = () => {
  const { t } = useTranslation('study');
  const overviewQuery = useStudyOverview(true, 'always');
  const n5 = overviewQuery.data?.jlptMastery?.N5;
  let body: ReactNode;

  if (overviewQuery.isLoading) {
    body = (
      <div className="p-8 text-center" role="status">
        <RefreshCw className="mx-auto h-7 w-7 animate-spin text-coral" aria-hidden="true" />
        <p className="mt-3 font-bold text-gray-600">{t('time.jlptMastery.loading')}</p>
      </div>
    );
  } else if (overviewQuery.isError) {
    body = (
      <div className="p-8 text-center">
        <p className="font-bold text-gray-700">{t('time.jlptMastery.error')}</p>
        <button
          type="button"
          className="mt-4 min-h-11 rounded-xl border-2 border-navy bg-navy px-5 py-2 font-black text-cream transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
          onClick={() => overviewQuery.refetch()}
        >
          {t('time.jlptMastery.retry')}
        </button>
      </div>
    );
  } else if (n5) {
    body = (
      <div className="p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <MasteryMetric
            label={t('time.jlptMastery.vocabulary')}
            metric={n5.vocabulary}
            tone="navy"
          />
          <MasteryMetric label={t('time.jlptMastery.grammar')} metric={n5.grammar} tone="coral" />
        </div>
        <p className="mt-4 text-xs font-semibold leading-relaxed text-gray-500">
          {t('time.jlptMastery.explanation')}
        </p>
      </div>
    );
  } else {
    body = (
      <p className="p-8 text-center font-bold text-gray-600">{t('time.jlptMastery.unavailable')}</p>
    );
  }

  return (
    <section className="retro-paper-panel overflow-hidden" aria-labelledby="jlpt-mastery-title">
      <div className="border-b border-navy/10 bg-gradient-to-r from-cyan-50 via-white to-orange-50 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="retro-caps text-coral">{t('time.jlptMastery.eyebrow')}</p>
            <h2 id="jlpt-mastery-title" className="retro-headline text-3xl text-navy">
              {t('time.jlptMastery.title')}
            </h2>
            <p className="mt-1 max-w-2xl text-sm font-semibold text-gray-500">
              {t('time.jlptMastery.description')}
            </p>
          </div>
          <BookOpenCheck className="h-9 w-9 shrink-0 text-coral" aria-hidden="true" />
        </div>
      </div>

      {body}
    </section>
  );
};

export default JlptMasteryCard;
