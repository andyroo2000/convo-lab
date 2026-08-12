import { useEffect, useRef, useState } from 'react';
import { Eye, Search, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  adminApi,
  getAdminUsers,
  type AdminReadRequestInit,
  type AdminUser,
} from '../../lib/adminApi';
import ConfirmModal from '../common/ConfirmModal';

export interface AdminUsersFeed {
  users: AdminUser[];
  searchQuery: string;
}

interface AdminUsersTabProps {
  isActive: boolean;
  currentAdminUserId: string;
  onUserFeedChange: (feed: AdminUsersFeed) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';

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

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

const AdminUsersTab = ({
  isActive,
  currentAdminUserId,
  onUserFeedChange,
  showToast,
}: AdminUsersTabProps) => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [confirmUser, setConfirmUser] = useState<{ id: string; email: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const readControllerRef = useRef<AbortController | null>(null);

  const fetchUsers = async (init?: AdminReadRequestInit): Promise<void> => {
    setIsLoading(true);
    setError('');
    try {
      const loadedUsers = await getAdminUsers(searchQuery, init);
      setUsers(loadedUsers);
      onUserFeedChange({ users: loadedUsers, searchQuery });
    } catch (err) {
      if (isAbortError(err)) return;
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      if (!init?.signal?.aborted) setIsLoading(false);
    }
  };

  const refreshUsers = (): Promise<void> => {
    readControllerRef.current?.abort();
    const controller = new AbortController();
    readControllerRef.current = controller;

    return fetchUsers({ signal: controller.signal }).finally(() => {
      if (readControllerRef.current === controller) {
        readControllerRef.current = null;
      }
    });
  };

  const handleSearchQueryChange = (nextSearchQuery: string) => {
    setSearchQuery(nextSearchQuery);
    onUserFeedChange({ users, searchQuery: nextSearchQuery });
  };

  const handleDeleteUser = async () => {
    if (!confirmUser) return;

    setIsDeleting(true);
    try {
      const response = await fetch(adminApi.user(confirmUser.id), {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete user');
      }
      refreshUsers();
      showToast('User deleted successfully', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete user', 'error');
    } finally {
      setIsDeleting(false);
      setConfirmUser(null);
    }
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (isActive) refreshUsers();

    return () => {
      readControllerRef.current?.abort();
      readControllerRef.current = null;
    };
  }, [isActive]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const selectedUser = users.find((user) => user.id === selectedUserId);

  return (
    <>
      {isActive && (
        <>
          {error && <div className="retro-admin-v3-alert is-error mb-6">{error}</div>}

          <div className="retro-admin-v3-pane">
            <div className="retro-admin-v3-search-row mb-6">
              <div className="relative flex-1 min-w-[20rem]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users by name or email..."
                  value={searchQuery}
                  onChange={(event) => handleSearchQueryChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') refreshUsers();
                  }}
                  className="retro-admin-v3-input pl-10"
                />
              </div>
              <button
                type="button"
                onClick={() => refreshUsers()}
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
                    {users.map((user) => (
                      <tr
                        key={user.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedUserId(user.id)}
                      >
                        <td className="px-3 sm:px-6 py-4">
                          <div>
                            <div className="font-medium text-navy whitespace-nowrap">
                              {user.displayName || user.name}
                            </div>
                            <div className="text-sm text-gray-500 whitespace-nowrap">
                              {user.email}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${getRoleBadgeClass(
                              user.role
                            )}`}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                          {user._count.episodes + user._count.courses} items
                        </td>
                        <td className="px-3 sm:px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                          {formatDate(user.createdAt)}
                        </td>
                        <td
                          className="px-3 sm:px-6 py-4 text-right"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => navigate(`/app/library?viewAs=${user.id}`)}
                              className="text-indigo-600 hover:text-indigo-800 transition-colors"
                              title={`View as ${user.displayName || user.name}`}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {user.role !== 'admin' && user.id !== currentAdminUserId && (
                              <button
                                type="button"
                                onClick={() => setConfirmUser({ id: user.id, email: user.email })}
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
        </>
      )}

      {selectedUser && (
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
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

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
      )}

      <ConfirmModal
        isOpen={!!confirmUser}
        title="Delete User"
        message={`Are you sure you want to delete user ${confirmUser?.email ?? ''}? This action cannot be undone.`}
        confirmLabel="Delete User"
        onConfirm={handleDeleteUser}
        onCancel={() => setConfirmUser(null)}
        isLoading={isDeleting}
        variant="danger"
      />
    </>
  );
};

export default AdminUsersTab;
