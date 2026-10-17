import { Link, Outlet, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const StudyImpersonationBoundary = () => {
  const { t } = useTranslation('study');
  const [searchParams] = useSearchParams();
  const viewAsUserId = searchParams.get('viewAs');

  if (!viewAsUserId) {
    return <Outlet />;
  }

  return (
    <section className="card retro-paper-panel mx-auto max-w-3xl" role="status">
      <h1 className="mb-3 text-3xl font-bold text-navy">{t('impersonationBoundary.title')}</h1>
      <p className="text-gray-600">{t('impersonationBoundary.description')}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to="/app/admin/users"
          className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white hover:bg-navy/90"
        >
          {t('impersonationBoundary.backToUsers')}
        </Link>
        <Link
          to="/app/study"
          className="rounded-full border border-gray-300 px-5 py-3 text-sm font-semibold text-navy hover:bg-gray-50"
        >
          {t('impersonationBoundary.exitAndOpenStudy')}
        </Link>
      </div>
    </section>
  );
};

export default StudyImpersonationBoundary;
