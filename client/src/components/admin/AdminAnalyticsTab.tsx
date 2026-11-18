import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { getJournalAnalytics, type AnalyticsPeriod } from '../../lib/journalAnalyticsApi';
import JournalActivity from './JournalActivity';
import JournalCostSummary from './JournalCostSummary';
import JournalCostView from './JournalCostView';
import JournalWriterTable from './JournalWriterTable';

const tabs = ['Activity', 'Writers', 'Costs'] as const;
const AdminAnalyticsTab = () => {
  const [tab, setTab] = useState<(typeof tabs)[number]>('Activity');
  const [period, setPeriod] = useState<AnalyticsPeriod>('daily');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['admin-journal-analytics', period, page],
    queryFn: ({ signal }) => getJournalAnalytics(period, page, signal),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
  return (
    <div className="admin-analytics">
      <div className="admin-panel-heading">
        <h2>Journal analytics</h2>
        <button
          type="button"
          className="admin-text-button"
          disabled={query.isFetching}
          onClick={() => {
            query.refetch();
          }}
        >
          Refresh
        </button>
      </div>
      {query.isPending && <p role="status">Loading Journal analytics…</p>}
      {query.isError && (
        <p role="alert" className="retro-admin-v3-alert is-error">
          Could not refresh analytics. Any figures below are from the last successful load. Please
          try Refresh.
        </p>
      )}
      {query.data && (
        <>
          <JournalCostSummary month={query.data.month} />
          <div className="admin-analytics-tabs" aria-label="Analytics views">
            {tabs.map((name) => (
              <button
                type="button"
                key={name}
                aria-pressed={tab === name}
                onClick={() => setTab(name)}
              >
                {name}
              </button>
            ))}
          </div>
          {tab === 'Activity' && <JournalActivity data={query.data} onPeriod={setPeriod} />}
          {tab === 'Writers' && (
            <JournalWriterTable writers={query.data.writers} onPage={setPage} />
          )}
          {tab === 'Costs' && <JournalCostView data={query.data} onPage={setPage} />}
        </>
      )}
    </div>
  );
};

export default AdminAnalyticsTab;
