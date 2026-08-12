import { useEffect, useRef, useState } from 'react';
import { BarChart3, Ticket, Users } from 'lucide-react';
import { getAdminStats, type AdminReadRequestInit, type AdminStats } from '../../lib/adminApi';

const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';

const AdminAnalyticsTab = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const readControllerRef = useRef<AbortController | null>(null);

  const fetchStats = async (init?: AdminReadRequestInit): Promise<void> => {
    setIsLoading(true);
    setError('');
    try {
      setStats(await getAdminStats(init));
    } catch (err) {
      if (isAbortError(err)) return;
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      if (!init?.signal?.aborted) setIsLoading(false);
    }
  };

  const refreshStats = (): Promise<void> => {
    readControllerRef.current?.abort();
    const controller = new AbortController();
    readControllerRef.current = controller;

    return fetchStats({ signal: controller.signal }).finally(() => {
      if (readControllerRef.current === controller) {
        readControllerRef.current = null;
      }
    });
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    refreshStats();

    return () => {
      readControllerRef.current?.abort();
      readControllerRef.current = null;
    };
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  return (
    <>
      {error && <div className="retro-admin-v3-alert is-error mb-6">{error}</div>}

      <div className="retro-admin-v3-pane">
        <h2 className="text-xl font-semibold text-navy mb-6">Platform Analytics</h2>

        {isLoading && <div className="text-center py-12 text-gray-500">Loading stats...</div>}
        {!isLoading && stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6 retro-admin-v3-card">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Total Users</h3>
                <Users className="w-5 h-5 text-indigo" />
              </div>
              <p className="text-3xl font-bold text-navy">{stats.users}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6 retro-admin-v3-card">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Episodes</h3>
                <BarChart3 className="w-5 h-5 text-indigo" />
              </div>
              <p className="text-3xl font-bold text-navy">{stats.episodes}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6 retro-admin-v3-card">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Courses</h3>
                <BarChart3 className="w-5 h-5 text-indigo" />
              </div>
              <p className="text-3xl font-bold text-navy">{stats.courses}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6 retro-admin-v3-card">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Invite Codes</h3>
                <Ticket className="w-5 h-5 text-indigo" />
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-600">
                  Total: <span className="font-semibold text-navy">{stats.inviteCodes.total}</span>
                </p>
                <p className="text-sm text-gray-600">
                  Used: <span className="font-semibold text-navy">{stats.inviteCodes.used}</span>
                </p>
                <p className="text-sm text-green-600">
                  Available: <span className="font-semibold">{stats.inviteCodes.available}</span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AdminAnalyticsTab;
