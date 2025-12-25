import { useAuth } from '../contexts/AuthContext';

/**
 * Hook to check if the current user is a demo user.
 * Demo users can browse content but cannot create or delete.
 * Named export is intentional for hooks
 */
// eslint-disable-next-line import/prefer-default-export
export function useIsDemo(): boolean {
  const { user } = useAuth();
  return user?.role === 'demo';
}
