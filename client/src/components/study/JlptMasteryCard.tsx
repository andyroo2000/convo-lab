import type { ReactNode } from 'react';
import { BookOpenCheck, ChevronDown, RefreshCw } from 'lucide-react';
import type { StudyJlptLevelMastery, StudyJlptMasteryMetric } from '@languageflow/shared/src/types';
import { useTranslation } from 'react-i18next';

import { useStudyOverview } from '../../hooks/useStudy';

interface MasteryMetricProps {
  level: 'N5' | 'N4';
  label: string;
  metric: StudyJlptMasteryMetric;
  tone: 'navy' | 'coral';
  showSourceBreakdown?: boolean;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

const MasteryMetric = ({
  level,
  label,
  metric,
  tone,
  showSourceBreakdown = false,
}: MasteryMetricProps) => {
  const { t } = useTranslation('study');
  const total = Math.max(0, metric.total);
  const matched = clamp(metric.matched ?? metric.covered, 0, total);
  const known = metric.known == null ? undefined : clamp(metric.known, 0, total);
  const knownFromCards =
    metric.knownFromCards == null ? undefined : clamp(metric.knownFromCards, 0, total);
  const knownFromWaniKani =
    metric.knownFromWaniKani == null ? undefined : clamp(metric.knownFromWaniKani, 0, total);
  const knownFromBoth =
    metric.knownFromBoth == null ? undefined : clamp(metric.knownFromBoth, 0, total);
  const masteryPercent = clamp(metric.masteryPercent, 0, 100);
  const barColor = tone === 'navy' ? 'bg-navy' : 'bg-coral';

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h4 className="text-lg font-black text-navy">{label}</h4>
        <p className="font-mono text-3xl font-black text-navy">{masteryPercent}%</p>
      </div>

      <div
        className="mt-3 h-3 overflow-hidden rounded-full bg-navy/10"
        role="progressbar"
        aria-label={t('time.jlptMastery.progressLabel', { level, category: label })}
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
        {showSourceBreakdown && knownFromCards !== undefined ? (
          <div className="flex items-center justify-between gap-4 pl-3">
            <dt className="font-semibold text-gray-500">
              {t('time.jlptMastery.cardsSourceLabel')}
            </dt>
            <dd className="font-mono font-black text-navy">{knownFromCards}</dd>
          </div>
        ) : null}
        {showSourceBreakdown && knownFromWaniKani !== undefined ? (
          <div className="flex items-center justify-between gap-4 pl-3">
            <dt className="font-semibold text-gray-500">
              {t('time.jlptMastery.wanikaniSourceLabel')}
            </dt>
            <dd className="font-mono font-black text-navy">{knownFromWaniKani}</dd>
          </div>
        ) : null}
        {showSourceBreakdown && knownFromBoth !== undefined && knownFromBoth > 0 ? (
          <div className="flex items-center justify-between gap-4 pl-3">
            <dt className="font-semibold text-gray-500">
              {t('time.jlptMastery.overlapSourceLabel')}
            </dt>
            <dd className="font-mono font-black text-navy">{knownFromBoth}</dd>
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

interface LevelBandProps {
  level: 'N5' | 'N4';
  mastery: StudyJlptLevelMastery;
}

const LevelBand = ({ level, mastery }: LevelBandProps) => {
  const { t } = useTranslation('study');
  const captionKey = level === 'N5' ? 'time.jlptMastery.n5Caption' : 'time.jlptMastery.n4Caption';

  return (
    <section
      className="rounded-lg border border-gray-200 bg-gray-50/70 p-4 sm:p-5"
      aria-labelledby={`jlpt-${level.toLowerCase()}-title`}
    >
      <div className="mb-4 flex items-end justify-between gap-4 border-b border-navy/10 pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {t('time.jlptMastery.levelEyebrow')}
          </p>
          <h3
            id={`jlpt-${level.toLowerCase()}-title`}
            className="font-mono text-2xl font-black text-navy"
          >
            {level}
          </h3>
        </div>
        <p className="text-right text-xs font-bold uppercase tracking-wide text-gray-500">
          {t(captionKey)}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <MasteryMetric
          level={level}
          label={t('time.jlptMastery.vocabulary')}
          metric={mastery.vocabulary}
          tone="navy"
          showSourceBreakdown
        />
        <MasteryMetric
          level={level}
          label={t('time.jlptMastery.grammar')}
          metric={mastery.grammar}
          tone="coral"
        />
      </div>
    </section>
  );
};

const JlptMasteryCard = () => {
  const { t } = useTranslation('study');
  const overviewQuery = useStudyOverview({ enabled: true, refetchOnMount: 'always' });
  const n5 = overviewQuery.data?.jlptMastery?.N5;
  const n4 = overviewQuery.data?.jlptMastery?.N4;
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
          className="app-button-primary mt-4"
          onClick={() => overviewQuery.refetch()}
        >
          {t('time.jlptMastery.retry')}
        </button>
      </div>
    );
  } else if (n5) {
    body = (
      <div className="p-6">
        <div className="space-y-5">
          <LevelBand level="N5" mastery={n5} />
          {n4 ? <LevelBand level="N4" mastery={n4} /> : null}
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
    <section className="card app-surface overflow-hidden" aria-labelledby="jlpt-mastery-title">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 border-gray-200 p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-navy group-open:border-b sm:p-6">
          <div className="flex min-w-0 items-start gap-3">
            <ChevronDown
              data-testid="jlpt-mastery-chevron"
              className="mt-1 h-5 w-5 shrink-0 text-coral transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('time.jlptMastery.eyebrow')}
              </p>
              <h2 id="jlpt-mastery-title" className="text-xl font-bold text-navy sm:text-2xl">
                {t('time.jlptMastery.title')}
              </h2>
              <p className="mt-1 max-w-2xl text-sm font-semibold text-gray-500">
                {t('time.jlptMastery.description')}
              </p>
            </div>
          </div>
          <BookOpenCheck className="h-9 w-9 shrink-0 text-coral" aria-hidden="true" />
        </summary>

        {body}
      </details>
    </section>
  );
};

export default JlptMasteryCard;
