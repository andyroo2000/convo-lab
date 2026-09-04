import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  adminApi,
  getAdminUsers,
  type AdminReadRequestInit,
  type AdminUser,
} from '../../lib/adminApi';
import ConfirmModal from '../common/ConfirmModal';
import AdminUsersTabView from './AdminUsersTabView';

export interface AdminUsersFeed {
  users: AdminUser[];
  searchQuery: string;
}
interface Props {
  isActive: boolean;
  currentAdminUserId: string;
  onUserFeedChange: (feed: AdminUsersFeed) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}
const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const AdminUsersTab = ({ isActive, currentAdminUserId, onUserFeedChange, showToast }: Props) => {
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
      const loaded = await getAdminUsers(searchQuery, init);
      setUsers(loaded);
      onUserFeedChange({ users: loaded, searchQuery });
    } catch (caught) {
      if (!isAbortError(caught)) setError(errorMessage(caught, 'Failed to fetch users'));
    } finally {
      if (!init?.signal?.aborted) setIsLoading(false);
    }
  };
  const refreshUsers = (): Promise<void> => {
    readControllerRef.current?.abort();
    const controller = new AbortController();
    readControllerRef.current = controller;
    return fetchUsers({ signal: controller.signal }).finally(() => {
      if (readControllerRef.current === controller) readControllerRef.current = null;
    });
  };
  const changeSearch = (value: string) => {
    setSearchQuery(value);
    onUserFeedChange({ users, searchQuery: value });
  };
  const deleteUser = async () => {
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
    } catch (caught) {
      showToast(errorMessage(caught, 'Failed to delete user'), 'error');
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
  const selectUser = (id: string) => setSelectedUserId(id || null);
  const viewUser = (id: string) => navigate(`/app/library?viewAs=${id}`);
  return (
    <>
      <AdminUsersTabView
        isActive={isActive}
        currentAdminUserId={currentAdminUserId}
        users={users}
        searchQuery={searchQuery}
        isLoading={isLoading}
        error={error}
        selectedUser={users.find((user) => user.id === selectedUserId)}
        onSearchQueryChange={changeSearch}
        onSearch={refreshUsers}
        onSelect={selectUser}
        onDelete={(user) => setConfirmUser({ id: user.id, email: user.email })}
        onView={viewUser}
      />
      <ConfirmModal
        isOpen={!!confirmUser}
        title="Delete User"
        message={`Are you sure you want to delete user ${confirmUser?.email ?? ''}? This action cannot be undone.`}
        confirmLabel="Delete User"
        onConfirm={deleteUser}
        onCancel={() => setConfirmUser(null)}
        isLoading={isDeleting}
        variant="danger"
      />
    </>
  );
};
export default AdminUsersTab;
