import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { adminApi } from '../lib/adminApi';

export type EffectiveUserStatus = 'idle' | 'loading' | 'ready' | 'error';

async function resolveImpersonatedUser(viewAsUserId: string, signal: AbortSignal): Promise<User> {
  try {
    const response = await fetch(adminApi.userInfo(viewAsUserId), {
      credentials: 'include',
      signal,
    });
    if (!response.ok) {
      throw new Error('Failed to fetch impersonated user');
    }

    const impersonatedUser = (await response.json()) as User;
    if (impersonatedUser.id !== viewAsUserId) {
      throw new Error('Impersonated user response did not match the requested user');
    }

    return impersonatedUser;
  } catch (error) {
    if (!signal.aborted) {
      console.error('Failed to fetch impersonated user:', error);
    }
    throw error;
  }
}

/**
 * Resolves the user whose preferences and identity the current route should display.
 * Authorization must continue to use the authenticated user from useAuth().
 */
export default function useEffectiveUser(): {
  effectiveUser: User | null;
  effectiveUserId: string | null;
  isImpersonating: boolean;
  loading: boolean;
  status: EffectiveUserStatus;
  retry: () => Promise<unknown>;
} {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const viewAsUserId = searchParams.get('viewAs');
  const authenticatedUserId = user?.id ?? null;
  const isImpersonating = !!viewAsUserId && !!authenticatedUserId && user?.role === 'admin';

  const impersonatedUserQuery = useQuery({
    queryKey: ['effective-user', authenticatedUserId, viewAsUserId],
    queryFn: ({ signal }) => resolveImpersonatedUser(viewAsUserId!, signal),
    enabled: isImpersonating,
    retry: false,
  });

  const effectiveUser = isImpersonating ? (impersonatedUserQuery.data ?? null) : user;
  let status: EffectiveUserStatus;
  if (!user) {
    status = 'idle';
  } else if (!isImpersonating || impersonatedUserQuery.isSuccess) {
    status = 'ready';
  } else if (impersonatedUserQuery.isError) {
    status = 'error';
  } else {
    status = 'loading';
  }

  return {
    effectiveUser,
    effectiveUserId: effectiveUser?.id ?? null,
    isImpersonating,
    loading: status === 'loading',
    status,
    retry: async () => impersonatedUserQuery.refetch(),
  };
}
