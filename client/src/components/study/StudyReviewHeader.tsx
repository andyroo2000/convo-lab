import type { ReactNode } from 'react';
import { Layers2, RotateCcw } from 'lucide-react';
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
  const remaining = counts.reviewRemaining + counts.newRemaining;
  const countLabel = t('reviewHeader.queueCounts', { failed: counts.failedDue, remaining });

  return (
    <header className="study-session-toolbar" data-testid="study-review-header">
      <button type="button" onClick={onExit} disabled={exitDisabled} className="study-session-exit">
        <span>{exitLabel ?? t('reviewHeader.exit')}</span>
      </button>
      <div
        className="study-queue-counts"
        data-testid="study-review-metrics"
        role="group"
        aria-label={countLabel}
        title={countLabel}
      >
        <span className="study-count-failed" aria-hidden="true">
          <RotateCcw size={15} />
          {counts.failedDue}
        </span>
        <span aria-hidden="true">·</span>
        <span aria-hidden="true">
          <Layers2 size={15} />
          {remaining}
        </span>
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
        </div>
      )}
    </header>
  );
};

export default StudyReviewHeader;
