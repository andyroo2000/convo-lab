import { Link } from 'react-router-dom';
import type { StudyOverview } from '@languageflow/shared/src/types';
import { useTranslation } from 'react-i18next';

interface StudyOverviewDashboardProps {
  headline: string;
  overview: StudyOverview | undefined;
  availableCount: number;
  loading: boolean;
  error: Error | null;
  onBeginStudy: () => void;
  isStartingSession: boolean;
}

const STUDY_ACTION_CLASS =
  'inline-flex min-h-11 items-center justify-center border-2 border-[#8b756d] bg-[#bfa192] px-4 py-2 text-center font-semibold uppercase tracking-[0.08em] text-[#fbf5e0] shadow-[0_4px_0_rgba(75,24,0,0.18)] transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dark-brown';

const StudyOverviewDashboard = ({
  headline,
  overview,
  availableCount,
  loading,
  error,
  onBeginStudy,
  isStartingSession,
}: StudyOverviewDashboardProps) => {
  const { t } = useTranslation('study');

  return (
    <div className="space-y-6">
      <section className="card retro-paper-panel space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-[13rem]">
            <button
              type="button"
              onClick={onBeginStudy}
              disabled={isStartingSession || availableCount === 0}
              className="inline-flex min-h-14 items-center justify-center border-2 border-navy/20 bg-navy px-6 py-3 font-black uppercase leading-none tracking-[0.01em] text-[#fbf5e0] shadow-[0_5px_0_rgba(17,51,92,0.18)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t('overview.begin')}
            </button>
            <p className="mt-2 text-gray-600">{headline}</p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
            <Link to="/app/study/browse" className={STUDY_ACTION_CLASS}>
              {t('overview.browse')}
            </Link>
            <Link to="/app/study/import" className={STUDY_ACTION_CLASS}>
              {t('overview.import')}
            </Link>
            <Link to="/app/study/create" className={STUDY_ACTION_CLASS}>
              {t('overview.create')}
            </Link>
            <Link to="/app/study/settings" className={STUDY_ACTION_CLASS}>
              {t('overview.settings')}
            </Link>
          </div>
        </div>
        {loading ? <p className="text-gray-500">{t('overview.loading')}</p> : null}
        {error ? <p className="text-red-600">{error.message}</p> : null}
        {availableCount === 0 && !loading ? (
          <div className="border border-dashed border-gray-300 bg-cream/70 p-4 text-center text-gray-600">
            {t('overview.empty')}
          </div>
        ) : null}
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
    </div>
  );
};

export default StudyOverviewDashboard;
