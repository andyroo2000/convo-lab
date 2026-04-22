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
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        onClick={onExit}
        className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-navy hover:bg-gray-50"
      >
        {t('reviewHeader.exit')}
      </button>
      <div className="text-right">
        <p className="text-lg font-semibold tracking-[0.08em] text-navy">
          <span className="text-blue-600">{newRemaining}</span>
          <span className="px-2 text-gray-400">+</span>
          <span className="text-red-600">{failedDue}</span>
          <span className="px-2 text-gray-400">+</span>
          <span className="text-emerald-700">{reviewRemaining}</span>
        </p>
        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-400">
          {t('reviewHeader.counts')}
        </p>
      </div>
    </div>
  );
};

export default StudyReviewHeader;
