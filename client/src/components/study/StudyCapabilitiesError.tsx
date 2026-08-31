import { useTranslation } from 'react-i18next';

const StudyCapabilitiesError = ({
  isError,
  isRetrying,
  onRetry,
}: {
  isError: boolean;
  isRetrying: boolean;
  onRetry: () => void;
}) => {
  const { t } = useTranslation('study');
  if (!isError) return null;

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      <span>{t('capabilities.error')}</span>
      <button
        type="button"
        disabled={isRetrying}
        onClick={onRetry}
        className="rounded-full border border-red-300 bg-white px-3 py-1.5 font-semibold text-red-800 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRetrying ? t('capabilities.retrying') : t('capabilities.retry')}
      </button>
    </div>
  );
};

export default StudyCapabilitiesError;
