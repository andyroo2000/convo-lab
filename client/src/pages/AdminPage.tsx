import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Users, Ticket, BarChart3, Image, Settings, TestTube } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AdminAnalyticsTab from '../components/admin/AdminAnalyticsTab';
import AdminAvatarsTab from '../components/admin/AdminAvatarsTab';
import AdminInviteCodesTab from '../components/admin/AdminInviteCodesTab';
import AdminSettingsTab from '../components/admin/AdminSettingsTab';
import AdminUsersTab, { type AdminUsersFeed } from '../components/admin/AdminUsersTab';
import Toast from '../components/common/Toast';
import ScriptLabTab from '../components/admin/scriptLab/ScriptLabTab';
import { getAdminUsers, type AdminReadRequestInit } from '../lib/adminApi';

type Tab = 'users' | 'invite-codes' | 'analytics' | 'avatars' | 'settings' | 'script-lab';

const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';

const AdminPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const activeTab: Tab = (tab as Tab) || 'users';
  const [userFeed, setUserFeed] = useState<AdminUsersFeed>({ users: [], searchQuery: '' });
  const [isAvatarUsersLoading, setIsAvatarUsersLoading] = useState(false);
  const [avatarUsersError, setAvatarUsersError] = useState('');
  const avatarUsersReadControllerRef = useRef<AbortController | null>(null);

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
    setIsAvatarUsersLoading(true);
    setAvatarUsersError('');
    try {
      const users = await getAdminUsers(userFeed.searchQuery, init);
      setUserFeed((currentFeed) => ({ ...currentFeed, users }));
    } catch (err) {
      if (isAbortError(err)) return;
      setAvatarUsersError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      if (!init?.signal?.aborted) setIsAvatarUsersLoading(false);
    }
  };

  const refreshAvatarUsers = (): Promise<void> => {
    avatarUsersReadControllerRef.current?.abort();
    const controller = new AbortController();
    avatarUsersReadControllerRef.current = controller;

    return fetchAvatarUsers({ signal: controller.signal }).finally(() => {
      if (avatarUsersReadControllerRef.current === controller) {
        avatarUsersReadControllerRef.current = null;
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
      setAvatarUsersError('');
    } else if (activeTab === 'invite-codes') {
      setAvatarUsersError('');
    } else if (activeTab === 'analytics') {
      setAvatarUsersError('');
    } else if (activeTab === 'avatars') {
      refreshAvatarUsers();
    } else if (activeTab === 'settings') {
      setAvatarUsersError('');
    }

    return () => {
      avatarUsersReadControllerRef.current?.abort();
      avatarUsersReadControllerRef.current = null;
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
          {avatarUsersError && (
            <div className="retro-admin-v3-alert is-error mb-6">{avatarUsersError}</div>
          )}

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
          {activeTab === 'analytics' && <AdminAnalyticsTab />}
          {/* Avatars Tab */}
          {activeTab === 'avatars' && (
            <AdminAvatarsTab
              users={userFeed.users}
              isUsersLoading={isAvatarUsersLoading}
              refreshUsers={refreshAvatarUsers}
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
