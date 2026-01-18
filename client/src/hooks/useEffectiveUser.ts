import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { User } from '../types';
import { useAuth } from '../contexts/AuthContext';

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
  const [impersonatedUser, setImpersonatedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If not impersonating, use the authenticated user
    if (!viewAsUserId || user?.role !== 'admin') {
      setImpersonatedUser(null);
      return;
    }

    // Fetch the impersonated user's data
    setLoading(true);
    fetch(`/api/admin/users/${viewAsUserId}`, {
      credentials: 'include',
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch impersonated user');
        }
        return res.json();
      })
      .then((data) => {
        setImpersonatedUser(data);
      })
      .catch((err) => {
        console.error('Failed to fetch impersonated user:', err);
        setImpersonatedUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [viewAsUserId, user?.role]);

  const isImpersonating = !!viewAsUserId && user?.role === 'admin' && !!impersonatedUser;
  const effectiveUser = isImpersonating ? impersonatedUser : user;

  return {
    effectiveUser,
    isImpersonating,
    loading,
  };
}
