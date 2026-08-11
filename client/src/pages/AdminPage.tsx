import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  Users,
  Ticket,
  BarChart3,
  Search,
  Trash2,
  Copy,
  Plus,
  Check,
  Image,
  Settings,
  Eye,
  TestTube,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AdminAvatarsTab from '../components/admin/AdminAvatarsTab';
import AdminSettingsTab from '../components/admin/AdminSettingsTab';
import ConfirmModal from '../components/common/ConfirmModal';
import Toast from '../components/common/Toast';
import ScriptLabTab from '../components/admin/scriptLab/ScriptLabTab';
import {
  adminApi,
  getAdminInviteCodes,
  getAdminStats,
  getAdminUsers,
  type AdminInviteCode,
  type AdminReadRequestInit,
  type AdminStats,
  type AdminUser,
} from '../lib/adminApi';

type Tab = 'users' | 'invite-codes' | 'analytics' | 'avatars' | 'settings' | 'script-lab';

const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';

const AdminPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const activeTab: Tab = (tab as Tab) || 'users';
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [inviteCodes, setInviteCodes] = useState<AdminInviteCode[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    | { type: 'delete-user'; id: string; email: string }
    | { type: 'delete-invite-code'; id: string; code: string }
    | null
  >(null);
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);
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

  const getRoleBadgeClass = (role: string): string => {
    switch (role) {
      case 'admin':
        return 'retro-admin-v3-badge retro-admin-v3-badge-admin';
      case 'moderator':
        return 'retro-admin-v3-badge retro-admin-v3-badge-moderator';
      case 'demo':
        return 'retro-admin-v3-badge retro-admin-v3-badge-demo';
      default:
        return 'retro-admin-v3-badge retro-admin-v3-badge-user';
    }
  };

  const fetchUsers = async (init?: AdminReadRequestInit) => {
    setIsLoading(true);
    setError('');
    try {
      setUsers(await getAdminUsers(searchQuery, init));
    } catch (err) {
      if (isAbortError(err)) return;
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      if (!init?.signal?.aborted) setIsLoading(false);
    }
  };

  const fetchInviteCodes = async (init?: AdminReadRequestInit) => {
    setIsLoading(true);
    setError('');
    try {
      setInviteCodes(await getAdminInviteCodes(init));
    } catch (err) {
      if (isAbortError(err)) return;
      setError(err instanceof Error ? err.message : 'Failed to fetch invite codes');
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

  const handleConfirmAction = async () => {
    if (!confirmAction) {
      return;
    }
    setIsConfirmingAction(true);
    try {
      if (confirmAction.type === 'delete-user') {
        const response = await fetch(adminApi.user(confirmAction.id), {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to delete user');
        }
        refreshDashboardRead(fetchUsers);
        showToast('User deleted successfully', 'success');
      } else if (confirmAction.type === 'delete-invite-code') {
        const response = await fetch(adminApi.inviteCode(confirmAction.id), {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to delete invite code');
        }
        refreshDashboardRead(fetchInviteCodes);
        showToast('Invite code deleted successfully', 'success');
      }
    } catch (err) {
      const fallbackMessage =
        confirmAction.type === 'delete-user'
          ? 'Failed to delete user'
          : 'Failed to delete invite code';
      showToast(err instanceof Error ? err.message : fallbackMessage, 'error');
    } finally {
      setIsConfirmingAction(false);
      setConfirmAction(null);
    }
  };

  const handleCreateInviteCode = async () => {
    try {
      const response = await fetch(adminApi.inviteCodes, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error('Failed to create invite code');
      refreshDashboardRead(fetchInviteCodes);
      showToast('Invite code created successfully', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create invite code', 'error');
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

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
      refreshDashboardRead(fetchUsers);
    } else if (activeTab === 'invite-codes') {
      refreshDashboardRead(fetchInviteCodes);
    } else if (activeTab === 'analytics') {
      refreshDashboardRead(fetchStats);
    } else if (activeTab === 'avatars') {
      refreshDashboardRead(fetchUsers);
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
          {activeTab === 'users' && (
            <div className="retro-admin-v3-pane">
              <div className="retro-admin-v3-search-row mb-6">
                <div className="relative flex-1 min-w-[20rem]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search users by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') refreshDashboardRead(fetchUsers);
                    }}
                    className="retro-admin-v3-input pl-10"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    refreshDashboardRead(fetchUsers);
                  }}
                  className="retro-admin-v3-btn-primary shrink-0"
                >
                  Search
                </button>
              </div>

              {isLoading ? (
                <div className="text-center py-12 text-gray-500">Loading users...</div>
              ) : (
                <div className="bg-white rounded-lg shadow overflow-x-auto retro-admin-v3-table-wrap">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                          User
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                          Role
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                          Content
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                          Joined
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((u) => (
                        <tr
                          key={u.id}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => setSelectedUserId(u.id)}
                        >
                          <td className="px-3 sm:px-6 py-4">
                            <div>
                              <div className="font-medium text-navy whitespace-nowrap">
                                {u.displayName || u.name}
                              </div>
                              <div className="text-sm text-gray-500 whitespace-nowrap">
                                {u.email}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-4">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${getRoleBadgeClass(
                                u.role
                              )}`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="px-3 sm:px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                            {u._count.episodes + u._count.courses} items
                          </td>
                          <td className="px-3 sm:px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                            {formatDate(u.createdAt)}
                          </td>
                          <td
                            className="px-3 sm:px-6 py-4 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => navigate(`/app/library?viewAs=${u.id}`)}
                                className="text-indigo-600 hover:text-indigo-800 transition-colors"
                                title={`View as ${u.displayName || u.name}`}
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {u.role !== 'admin' && u.id !== user.id && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmAction({
                                      type: 'delete-user',
                                      id: u.id,
                                      email: u.email,
                                    })
                                  }
                                  className="text-red-600 hover:text-red-800 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {users.length === 0 && (
                    <div className="text-center py-12 text-gray-500">No users found</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Invite Codes Tab */}
          {activeTab === 'invite-codes' && (
            <div className="retro-admin-v3-pane">
              <div className="retro-admin-v3-pane-header mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-navy">Invite Codes</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Create and manage invite codes for new users
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCreateInviteCode}
                  className="retro-admin-v3-btn-primary flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create Code
                </button>
              </div>

              {isLoading ? (
                <div className="text-center py-12 text-gray-500">Loading invite codes...</div>
              ) : (
                <div className="bg-white rounded-lg shadow overflow-x-auto retro-admin-v3-table-wrap">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                          Code
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                          Status
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                          Used By
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                          Created
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {inviteCodes.map((code) => (
                        <tr key={code.id} className="hover:bg-gray-50">
                          <td className="px-3 sm:px-6 py-4">
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              <code className="font-mono font-semibold text-navy">{code.code}</code>
                              <button
                                type="button"
                                onClick={() => handleCopyCode(code.code)}
                                className="text-gray-400 hover:text-indigo transition-colors"
                                title="Copy code"
                              >
                                {copiedCode === code.code ? (
                                  <Check className="w-4 h-4 text-green-600" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-4">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${
                                code.usedBy
                                  ? 'bg-gray-100 text-gray-800'
                                  : 'bg-green-100 text-green-800'
                              }`}
                            >
                              {code.usedBy ? 'Used' : 'Available'}
                            </span>
                          </td>
                          <td className="px-3 sm:px-6 py-4 text-sm text-gray-500">
                            {code.user ? (
                              <div className="whitespace-nowrap">
                                <div className="font-medium">{code.user.name}</div>
                                <div className="text-xs text-gray-400">{code.user.email}</div>
                              </div>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="px-3 sm:px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                            {formatDate(code.createdAt)}
                          </td>
                          <td className="px-3 sm:px-6 py-4 text-right">
                            {!code.usedBy && (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmAction({
                                    type: 'delete-invite-code',
                                    id: code.id,
                                    code: code.code,
                                  })
                                }
                                className="text-red-600 hover:text-red-800 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {inviteCodes.length === 0 && (
                    <div className="text-center py-12 text-gray-500">No invite codes found</div>
                  )}
                </div>
              )}
            </div>
          )}

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
              users={users}
              isUsersLoading={isLoading}
              refreshUsers={() => refreshDashboardRead(fetchUsers)}
              showToast={showToast}
            />
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && <AdminSettingsTab showToast={showToast} />}

          {/* Script Lab Tab */}
          {activeTab === 'script-lab' && <ScriptLabTab />}
        </div>
      </div>

      {/* User Details Modal */}
      {selectedUserId &&
        (() => {
          const selectedUser = users.find((u) => u.id === selectedUserId);
          if (!selectedUser) return null;

          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-navy">User Details</h2>
                    <button
                      type="button"
                      onClick={() => setSelectedUserId(null)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* User Info */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-semibold text-navy mb-2">User Information</h3>
                    <div className="space-y-1 text-sm">
                      <p>
                        <span className="font-medium">Name:</span>{' '}
                        {selectedUser.displayName || selectedUser.name}
                      </p>
                      <p>
                        <span className="font-medium">Email:</span> {selectedUser.email}
                      </p>
                      <p>
                        <span className="font-medium">Role:</span> {selectedUser.role}
                      </p>
                    </div>
                  </div>

                  {/* Admin Actions */}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => navigate(`/app/library?viewAs=${selectedUser.id}`)}
                      className="btn-secondary flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      Impersonate User
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedUserId(null)}
                      className="btn-secondary"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Toast Notification */}
      <ConfirmModal
        isOpen={!!confirmAction}
        title={confirmAction?.type === 'delete-user' ? 'Delete User' : 'Delete Invite Code'}
        message={
          confirmAction?.type === 'delete-user'
            ? `Are you sure you want to delete user ${confirmAction?.email ?? ''}? This action cannot be undone.`
            : `Are you sure you want to delete invite code ${confirmAction?.code ?? ''}?`
        }
        confirmLabel={confirmAction?.type === 'delete-user' ? 'Delete User' : 'Delete Code'}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmAction(null)}
        isLoading={isConfirmingAction}
        variant="danger"
      />
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
