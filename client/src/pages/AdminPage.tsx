import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Users, Ticket, BarChart3, Image, Settings, TestTube } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AdminAvatarsTab from '../components/admin/AdminAvatarsTab';
import AdminInviteCodesTab from '../components/admin/AdminInviteCodesTab';
import AdminSettingsTab from '../components/admin/AdminSettingsTab';
import AdminUsersTab, { type AdminUsersFeed } from '../components/admin/AdminUsersTab';
import Toast from '../components/common/Toast';
import ScriptLabTab from '../components/admin/scriptLab/ScriptLabTab';
import {
  getAdminStats,
  getAdminUsers,
  type AdminReadRequestInit,
  type AdminStats,
} from '../lib/adminApi';

type Tab = 'users' | 'invite-codes' | 'analytics' | 'avatars' | 'settings' | 'script-lab';

const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';

const AdminPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const activeTab: Tab = (tab as Tab) || 'users';
  const [userFeed, setUserFeed] = useState<AdminUsersFeed>({ users: [], searchQuery: '' });
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const dashboardReadControllerRef = useRef<AbortController | null>(null);

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const fetchAvatarUsers = async (init?: AdminReadRequestInit) => {
    setIsLoading(true);
    setError('');
    try {
      const users = await getAdminUsers(userFeed.searchQuery, init);
      setUserFeed((currentFeed) => ({ ...currentFeed, users }));
    } catch (err) {
      if (isAbortError(err)) return;
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      if (!init?.signal?.aborted) setIsLoading(false);
    }
  };

  const fetchStats = async (init?: AdminReadRequestInit) => {
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

  const refreshDashboardRead = (
    read: (init: AdminReadRequestInit) => Promise<void>
  ): Promise<void> => {
    dashboardReadControllerRef.current?.abort();
    const controller = new AbortController();
    dashboardReadControllerRef.current = controller;

    return read({ signal: controller.signal }).finally(() => {
      if (dashboardReadControllerRef.current === controller) {
        dashboardReadControllerRef.current = null;
      }
    });
  };

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/app/library');
    }
  }, [user, navigate]);

  // Fetch data based on active tab
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (activeTab === 'users') {
      setError('');
    } else if (activeTab === 'invite-codes') {
      setError('');
    } else if (activeTab === 'analytics') {
      refreshDashboardRead(fetchStats);
    } else if (activeTab === 'avatars') {
      refreshDashboardRead(fetchAvatarUsers);
    } else if (activeTab === 'settings') {
      setError('');
    }

    return () => {
      dashboardReadControllerRef.current?.abort();
      dashboardReadControllerRef.current = null;
    };
  }, [activeTab]);
  /* eslint-enable react-hooks/exhaustive-deps */

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="max-w-[80rem] mx-auto retro-admin-v3-wrap">
      <div className="retro-admin-v3-shell">
        <div className="retro-admin-v3-top">
          <h1 className="retro-admin-v3-title">Admin Dashboard</h1>
          <p className="retro-admin-v3-subtitle">Manage users, invite codes, and view analytics</p>
        </div>

        <div className="retro-admin-v3-main">
          {/* Tabs */}
          <div className="retro-admin-v3-tabs-wrap">
            <nav className="retro-admin-v3-tabs">
              <Link
                to="/app/admin/users"
                className={`retro-admin-v3-tab ${
                  activeTab === 'users' ? 'is-active border-indigo font-semibold' : ''
                }`}
              >
                <Users className="w-4 h-4" />
                Users
              </Link>
              <Link
                to="/app/admin/invite-codes"
                className={`retro-admin-v3-tab ${
                  activeTab === 'invite-codes' ? 'is-active border-indigo font-semibold' : ''
                }`}
              >
                <Ticket className="w-4 h-4" />
                Invite Codes
              </Link>
              <Link
                to="/app/admin/analytics"
                className={`retro-admin-v3-tab ${
                  activeTab === 'analytics' ? 'is-active border-indigo font-semibold' : ''
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Analytics
              </Link>
              <Link
                to="/app/admin/avatars"
                className={`retro-admin-v3-tab ${
                  activeTab === 'avatars' ? 'is-active border-indigo font-semibold' : ''
                }`}
              >
                <Image className="w-4 h-4" />
                Avatars
              </Link>
              <Link
                to="/app/admin/settings"
                className={`retro-admin-v3-tab ${
                  activeTab === 'settings' ? 'is-active border-indigo font-semibold' : ''
                }`}
              >
                <Settings className="w-4 h-4" />
                Settings
              </Link>
              <Link
                to="/app/admin/script-lab"
                className={`retro-admin-v3-tab ${
                  activeTab === 'script-lab' ? 'is-active border-indigo font-semibold' : ''
                }`}
              >
                <TestTube className="w-4 h-4" />
                Script Lab
              </Link>
            </nav>
          </div>

          {/* Error Message */}
          {error && <div className="retro-admin-v3-alert is-error mb-6">{error}</div>}

          {/* Users Tab */}
          <AdminUsersTab
            isActive={activeTab === 'users'}
            currentAdminUserId={user.id}
            onUserFeedChange={setUserFeed}
            showToast={showToast}
          />
          {/* Invite Codes Tab */}
          {activeTab === 'invite-codes' && <AdminInviteCodesTab showToast={showToast} />}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="retro-admin-v3-pane">
              <h2 className="text-xl font-semibold text-navy mb-6">Platform Analytics</h2>

              {isLoading && <div className="text-center py-12 text-gray-500">Loading stats...</div>}
              {!isLoading && stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Users */}
                  <div className="bg-white rounded-lg shadow p-6 retro-admin-v3-card">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-600">Total Users</h3>
                      <Users className="w-5 h-5 text-indigo" />
                    </div>
                    <p className="text-3xl font-bold text-navy">{stats.users}</p>
                  </div>

                  {/* Episodes */}
                  <div className="bg-white rounded-lg shadow p-6 retro-admin-v3-card">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-600">Episodes</h3>
                      <BarChart3 className="w-5 h-5 text-indigo" />
                    </div>
                    <p className="text-3xl font-bold text-navy">{stats.episodes}</p>
                  </div>

                  {/* Courses */}
                  <div className="bg-white rounded-lg shadow p-6 retro-admin-v3-card">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-600">Courses</h3>
                      <BarChart3 className="w-5 h-5 text-indigo" />
                    </div>
                    <p className="text-3xl font-bold text-navy">{stats.courses}</p>
                  </div>

                  {/* Invite Codes */}
                  <div className="bg-white rounded-lg shadow p-6 retro-admin-v3-card">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-600">Invite Codes</h3>
                      <Ticket className="w-5 h-5 text-indigo" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600">
                        Total:{' '}
                        <span className="font-semibold text-navy">{stats.inviteCodes.total}</span>
                      </p>
                      <p className="text-sm text-gray-600">
                        Used:{' '}
                        <span className="font-semibold text-navy">{stats.inviteCodes.used}</span>
                      </p>
                      <p className="text-sm text-green-600">
                        Available:{' '}
                        <span className="font-semibold">{stats.inviteCodes.available}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Avatars Tab */}
          {activeTab === 'avatars' && (
            <AdminAvatarsTab
              users={userFeed.users}
              isUsersLoading={isLoading}
              refreshUsers={() => refreshDashboardRead(fetchAvatarUsers)}
              showToast={showToast}
            />
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && <AdminSettingsTab showToast={showToast} />}

          {/* Script Lab Tab */}
          {activeTab === 'script-lab' && <ScriptLabTab />}
        </div>
      </div>

      {/* Toast Notification */}
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={toastVisible}
        onClose={() => setToastVisible(false)}
      />
    </div>
  );
};

export default AdminPage;
