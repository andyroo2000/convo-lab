import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { adminApi } from '../lib/adminApi';

/**
 * Hook that returns the effective user for the current context.
 * If admin is impersonating (viewAs parameter present), returns the impersonated user's data.
 * Otherwise returns the authenticated user's data.
 *
 * This ensures that UI elements (language preferences, defaults, etc.) reflect
 * the impersonated user's settings during admin impersonation.
 */
export default function useEffectiveUser(): {
  effectiveUser: User | null;
  isImpersonating: boolean;
  loading: boolean;
} {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const viewAsUserId = searchParams.get('viewAs');
  const [impersonatedUser, setImpersonatedUser] = useState<{
    viewAsUserId: string;
    user: User;
  } | null>(null);
  const [resolvedViewAsUserId, setResolvedViewAsUserId] = useState<string | null>(null);
  const requestGenerationRef = useRef(0);
  const shouldLoadImpersonatedUser = !!viewAsUserId && user?.role === 'admin';

  useEffect(() => {
    requestGenerationRef.current += 1;
    const requestGeneration = requestGenerationRef.current;
    const controller = new AbortController();

    // Clear the stored identity immediately after every scope transition. The render-time
    // viewAs guard below also prevents this previous identity from being observed before the
    // effect runs.
    setImpersonatedUser(null);
    setResolvedViewAsUserId(null);

    // If not impersonating, use the authenticated user
    if (!shouldLoadImpersonatedUser || !viewAsUserId) {
      return () => controller.abort();
    }

    // Fetch the impersonated user's data
    fetch(adminApi.userInfo(viewAsUserId), {
      credentials: 'include',
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch impersonated user');
        }
        return res.json();
      })
      .then((data: User) => {
        if (controller.signal.aborted || requestGenerationRef.current !== requestGeneration) return;
        setImpersonatedUser({ viewAsUserId, user: data });
        setResolvedViewAsUserId(viewAsUserId);
      })
      .catch((err) => {
        if (controller.signal.aborted || requestGenerationRef.current !== requestGeneration) return;
        console.error('Failed to fetch impersonated user:', err);
        setImpersonatedUser(null);
        setResolvedViewAsUserId(viewAsUserId);
      });

    return () => controller.abort();
  }, [shouldLoadImpersonatedUser, user?.id, viewAsUserId]);

  const resolvedImpersonatedUser =
    shouldLoadImpersonatedUser && impersonatedUser?.viewAsUserId === viewAsUserId
      ? impersonatedUser.user
      : null;
  const isImpersonating = resolvedImpersonatedUser !== null;
  const effectiveUser = shouldLoadImpersonatedUser ? resolvedImpersonatedUser : user;
  const loading = shouldLoadImpersonatedUser && resolvedViewAsUserId !== viewAsUserId;

  return {
    effectiveUser,
    isImpersonating,
    loading,
  };
}
