import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface StudyReviewHeaderProps {
  newRemaining: number;
  failedDue: number;
  reviewRemaining: number;
  progress: number;
  actions?: ReactNode;
  onExit: () => void;
}

const StudyReviewHeader = ({
  newRemaining,
  failedDue,
  reviewRemaining,
  progress,
  actions,
  onExit,
}: StudyReviewHeaderProps) => {
  const { t } = useTranslation('study');

  return (
    <div className="space-y-2" data-testid="study-review-header">
      <div
        className="h-1.5 overflow-hidden rounded-full bg-navy/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-label={t('reviewHeader.progress')}
      >
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
          style={{ width: `${String(progress * 100)}%` }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-1.5 md:gap-2">
        <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
          <button
            type="button"
            onClick={onExit}
            className="rounded-full border border-gray-300 px-2.5 py-1 text-xs font-medium text-navy hover:bg-gray-50"
          >
            {t('reviewHeader.exit')}
          </button>
          {actions}
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold tracking-[0.08em] text-navy md:text-base">
            <span className="text-red-600">{failedDue}</span>
            <span className="px-1.5 text-gray-400">+</span>
            <span className="text-emerald-700">{reviewRemaining}</span>
            <span className="px-1.5 text-gray-400">+</span>
            <span className="text-blue-600">{newRemaining}</span>
          </p>
          <p className="sr-only">{t('reviewHeader.counts')}</p>
        </div>
      </div>
    </div>
  );
};

export default StudyReviewHeader;
