import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';

import { useFeatureFlags } from '../../hooks/useFeatureFlags';

const StudyFeatureBoundary = () => {
  const { t } = useTranslation('study');
  const { isFeatureEnabled, refetch, status } = useFeatureFlags();

  if (isFeatureEnabled('flashcardsEnabled')) {
    return <Outlet />;
  }

  let message = t('disabled');
  if (status === 'loading') {
    message = t('featureAvailability.loading');
  } else if (status === 'error') {
    message = t('featureAvailability.error');
  }

  return (
    <section
      className="card retro-paper-panel mx-auto max-w-3xl space-y-4"
      role={status === 'error' ? 'alert' : 'status'}
    >
      <h1 className="text-3xl font-bold text-navy">{t('title')}</h1>
      <p className="text-gray-600">{message}</p>
      {status === 'error' ? (
        <button
          type="button"
          onClick={() => {
            Promise.resolve(refetch()).catch(() => undefined);
          }}
          className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white hover:bg-navy/90"
        >
          {t('featureAvailability.retry')}
        </button>
      ) : null}
    </section>
  );
};

export default StudyFeatureBoundary;
