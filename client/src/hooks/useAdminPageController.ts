import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import type { AdminUsersFeed } from '../components/admin/AdminUsersTab';
import { useAuth } from '../contexts/AuthContext';
import { getAdminUsers, type AdminReadRequestInit } from '../lib/adminApi';

export type AdminTab =
  | 'users'
  | 'invite-codes'
  | 'analytics'
  | 'avatars'
  | 'settings'
  | 'script-lab';

export type AdminToastType = 'success' | 'error' | 'info';

const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';

interface FetchAdminAvatarUsersOptions {
  init?: AdminReadRequestInit;
  searchQuery: string;
  setAvatarUsersError: Dispatch<SetStateAction<string>>;
  setIsAvatarUsersLoading: Dispatch<SetStateAction<boolean>>;
  setUserFeed: Dispatch<SetStateAction<AdminUsersFeed>>;
}

const fetchAdminAvatarUsers = async ({
  init,
  searchQuery,
  setAvatarUsersError,
  setIsAvatarUsersLoading,
  setUserFeed,
}: FetchAdminAvatarUsersOptions) => {
  setIsAvatarUsersLoading(true);
  setAvatarUsersError('');
  try {
    const users = await getAdminUsers(searchQuery, init);
    setUserFeed((currentFeed) => ({ ...currentFeed, users }));
  } catch (err) {
    if (isAbortError(err)) return;
    setAvatarUsersError(err instanceof Error ? err.message : 'Failed to fetch users');
  } finally {
    if (!init?.signal?.aborted) setIsAvatarUsersLoading(false);
  }
};

const useAdminToast = () => {
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<AdminToastType>('success');

  const showToast = (message: string, type: AdminToastType = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  return { setToastVisible, showToast, toastMessage, toastType, toastVisible };
};

const useAdminAvatarUsers = (activeTab: AdminTab) => {
  const [userFeed, setUserFeed] = useState<AdminUsersFeed>({ users: [], searchQuery: '' });
  const [isAvatarUsersLoading, setIsAvatarUsersLoading] = useState(false);
  const [avatarUsersError, setAvatarUsersError] = useState('');
  const avatarUsersReadControllerRef = useRef<AbortController | null>(null);

  const fetchAvatarUsers = (init?: AdminReadRequestInit) =>
    fetchAdminAvatarUsers({
      init,
      searchQuery: userFeed.searchQuery,
      setAvatarUsersError,
      setIsAvatarUsersLoading,
      setUserFeed,
    });

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

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (activeTab === 'avatars') {
      refreshAvatarUsers();
    } else if (activeTab !== 'script-lab') {
      setAvatarUsersError('');
    }

    return () => {
      avatarUsersReadControllerRef.current?.abort();
      avatarUsersReadControllerRef.current = null;
    };
  }, [activeTab]);
  /* eslint-enable react-hooks/exhaustive-deps */

  return {
    avatarUsersError,
    isAvatarUsersLoading,
    refreshAvatarUsers,
    setUserFeed,
    userFeed,
  };
};

const useAdminPageController = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const activeTab: AdminTab = (tab as AdminTab) || 'users';
  const toast = useAdminToast();

  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/app/library');
    }
  }, [user, navigate]);

  const avatarUsers = useAdminAvatarUsers(activeTab);

  return { activeTab, user, ...avatarUsers, ...toast };
};

export default useAdminPageController;
