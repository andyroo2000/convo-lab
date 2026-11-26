import { useTranslation } from 'react-i18next';

function formatLastSync(value: string | null, fallback: string) {
  if (!value) return fallback;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? fallback : new Date(timestamp).toLocaleString();
}

export const ConnectedBadge = () => {
  const { t } = useTranslation('study');
  return (
    <span className="rounded-full bg-[#edf1e6] px-3 py-1 text-base text-[#36583e]">
      {t('time.calendarConnection.connected')}
    </span>
  );
};

export const LastSyncRow = ({ timestamp }: { timestamp: string | null }) => {
  const { t } = useTranslation('study');
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 py-2">
      <dt className="text-base text-[#63705e]">{t('time.calendarConnection.lastSync')}</dt>
      <dd className="mt-1 text-sm font-medium text-inherit">
        {formatLastSync(timestamp, t('time.calendarConnection.notSynced'))}
      </dd>
    </div>
  );
};
