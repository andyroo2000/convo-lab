import { Link } from 'react-router-dom';
import type { StudyOverview } from '@languageflow/shared/src/types';
import { useTranslation } from 'react-i18next';

interface StudyOverviewDashboardProps {
  headline: string;
  overview: StudyOverview | undefined;
  availableCount: number;
  loading: boolean;
  error: Error | null;
  onRefresh: () => void;
  onBeginStudy: () => void;
  isStartingSession: boolean;
}

const StudyOverviewDashboard = ({
  headline,
  overview,
  availableCount,
  loading,
  error,
  onRefresh,
  onBeginStudy,
  isStartingSession,
}: StudyOverviewDashboardProps) => {
  const { t } = useTranslation('study');

  return (
    <div className="space-y-6">
      <section className="card retro-paper-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-navy">{t('title')}</h1>
            <p className="text-gray-600">{headline}</p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <Link
              to="/app/study/browse"
              className="retro-nav-tab inline-flex items-center justify-center text-white hover:bg-white/20"
            >
              {t('overview.browse')}
            </Link>
            <Link
              to="/app/study/import"
              className="retro-nav-tab inline-flex items-center justify-center text-white hover:bg-white/20"
            >
              {t('overview.import')}
            </Link>
            <Link
              to="/app/study/create"
              className="retro-nav-tab inline-flex items-center justify-center text-white hover:bg-white/20"
            >
              {t('overview.create')}
            </Link>
            <Link
              to="/app/study/history"
              className="retro-nav-tab inline-flex items-center justify-center text-white hover:bg-white/20"
            >
              {t('overview.history')}
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="card retro-paper-panel">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{t('overview.due')}</p>
          <p className="text-3xl font-bold text-navy">{overview?.dueCount ?? 0}</p>
        </div>
        <div className="card retro-paper-panel">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{t('overview.new')}</p>
          <p className="text-3xl font-bold text-navy">{overview?.newCount ?? 0}</p>
        </div>
        <div className="card retro-paper-panel">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
            {t('overview.learning')}
          </p>
          <p className="text-3xl font-bold text-navy">{overview?.learningCount ?? 0}</p>
        </div>
        <div className="card retro-paper-panel">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{t('overview.total')}</p>
          <p className="text-3xl font-bold text-navy">{overview?.totalCards ?? 0}</p>
        </div>
      </section>

      <section className="card retro-paper-panel space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-navy">{t('overview.readyTitle')}</h2>
            <p className="text-sm text-gray-500">{t('overview.readyDescription')}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-navy hover:bg-gray-50"
            >
              {t('overview.refresh')}
            </button>
            <button
              type="button"
              onClick={onBeginStudy}
              disabled={isStartingSession || availableCount === 0}
              className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t('overview.begin')}
            </button>
          </div>
        </div>

        {loading ? <p className="text-gray-500">{t('overview.loading')}</p> : null}
        {error ? <p className="text-red-600">{error.message}</p> : null}

        {availableCount === 0 && !loading ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600">
            {t('overview.empty')}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-cream/70 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">
                {t('overview.availableNow')}
              </p>
              <p className="mt-3 text-2xl font-semibold text-navy">
                {t('overview.availableReady', { count: availableCount })}
              </p>
            </div>
            <div className="rounded-2xl bg-cream/70 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">
                {t('overview.loadStrategy')}
              </p>
              <p className="mt-3 text-base text-navy">{t('overview.loadStrategyDescription')}</p>
            </div>
            <div className="rounded-2xl bg-cream/70 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">
                {t('overview.keyboard')}
              </p>
              <p className="mt-3 text-base text-navy">{t('overview.keyboardDescription')}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default StudyOverviewDashboard;
