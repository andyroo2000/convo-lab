import { useTranslation } from 'react-i18next';

interface StudyReviewHeaderProps {
  newRemaining: number;
  failedDue: number;
  reviewRemaining: number;
  onExit: () => void;
}

const StudyReviewHeader = ({
  newRemaining,
  failedDue,
  reviewRemaining,
  onExit,
}: StudyReviewHeaderProps) => {
  const { t } = useTranslation('study');

  return (
    <div
      className="flex items-center justify-between gap-2 md:flex-wrap md:gap-3"
      data-testid="study-review-header"
    >
      <button
        type="button"
        onClick={onExit}
        className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-navy hover:bg-gray-50 md:px-4 md:py-2 md:text-sm"
      >
        {t('reviewHeader.exit')}
      </button>
      <div className="text-right">
        <p className="text-sm font-semibold tracking-[0.08em] text-navy md:text-lg">
          <span className="text-blue-600">{newRemaining}</span>
          <span className="px-1.5 text-gray-400 md:px-2">+</span>
          <span className="text-red-600">{failedDue}</span>
          <span className="px-1.5 text-gray-400 md:px-2">+</span>
          <span className="text-emerald-700">{reviewRemaining}</span>
        </p>
        <p className="sr-only mt-1 text-xs uppercase tracking-[0.18em] text-gray-400 md:not-sr-only">
          {t('reviewHeader.counts')}
        </p>
      </div>
    </div>
  );
};

export default StudyReviewHeader;
