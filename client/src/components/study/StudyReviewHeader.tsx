import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface StudyReviewHeaderProps {
  progress: { completed: number; total: number };
  counts: {
    failedDue: number;
    reviewRemaining: number;
    newRemaining: number;
  };
  actions?: ReactNode;
  onExit: () => void;
  exitLabel?: string;
  exitDisabled?: boolean;
}

const StudyReviewHeader = ({
  progress,
  counts,
  actions,
  onExit,
  exitLabel,
  exitDisabled,
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
    <header className="study-session-toolbar" data-testid="study-review-header">
      <button type="button" onClick={onExit} disabled={exitDisabled} className="study-session-exit">
        {exitLabel ?? t('reviewHeader.exit')}
      </button>
      <div className="sr-only" data-testid="study-review-metrics">
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
      </div>
      <div className="ml-auto">{actions}</div>
      {progress.total > 0 && (
        <div className="study-session-progress">
          <div
            className="study-session-progress-track"
            role="progressbar"
            aria-label={t('reviewHeader.progress')}
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.completed}
            aria-valuetext={t('reviewHeader.completed', progress)}
          >
            <div style={{ width: `${String((100 * progress.completed) / progress.total)}%` }} />
          </div>
          <span aria-hidden="true">{t('reviewHeader.completed', progress)}</span>
        </div>
      )}
    </header>
  );
};

export default StudyReviewHeader;
