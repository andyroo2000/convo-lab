import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface StudyReviewHeaderProps {
  progress: number;
  counts: {
    failedDue: number;
    reviewRemaining: number;
    newRemaining: number;
  };
  actions?: ReactNode;
  onExit: () => void;
  exitLabel?: string;
}

const StudyReviewHeader = ({
  progress,
  counts,
  actions,
  onExit,
  exitLabel,
}: StudyReviewHeaderProps) => {
  const { t } = useTranslation('study');
  const metrics = [
    { label: t('reviewHeader.failed'), value: counts.failedDue, className: 'text-coral-dark' },
    {
      label: t('reviewHeader.queued'),
      value: counts.reviewRemaining,
      className: 'text-emerald-700',
    },
    {
      label: t('reviewHeader.new'),
      value: counts.newRemaining,
      className: 'text-periwinkle-dark',
    },
  ];

  return (
    <header className="space-y-2" data-testid="study-review-header">
      <div className="flex items-center gap-3 pb-2" data-testid="study-review-metrics">
        <div
          className="grid min-w-0 flex-1 grid-cols-3"
          role="group"
          aria-label={t('reviewHeader.counts', {
            failed: counts.failedDue,
            queued: counts.reviewRemaining,
            new: counts.newRemaining,
          })}
        >
          {metrics.map((metric) => (
            <div key={metric.label} className="text-center">
              <p className={`text-base font-bold tabular-nums ${metric.className}`}>
                {metric.value}
              </p>
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-gray-500">
                {metric.label}
              </p>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onExit}
          className="app-button-secondary shrink-0 px-3 py-2 text-xs"
        >
          {exitLabel ?? t('reviewHeader.exit')}
        </button>
      </div>
      <div
        className="h-1 overflow-hidden rounded-full bg-navy/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-label={t('reviewHeader.progress')}
      >
        <div
          className="h-full rounded-full bg-emerald-600 transition-[width] duration-300"
          style={{ width: `${String(progress * 100)}%` }}
        />
      </div>
      {actions}
    </header>
  );
};

export default StudyReviewHeader;
