import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';

export interface FeatureFlags {
  id: string;
  dialoguesEnabled: boolean;
  scriptsEnabled: boolean;
  audioCourseEnabled: boolean;
  flashcardsEnabled: boolean;
  updatedAt: string;
}

export type FeatureFlagStatus = 'loading' | 'ready' | 'error' | 'adminOverride';

async function fetchFeatureFlags(): Promise<FeatureFlags> {
  const response = await fetch('/api/feature-flags', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch feature flags');
  }
  return response.json();
}

export function useFeatureFlags() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const {
    data: flags,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['featureFlags'],
    queryFn: fetchFeatureFlags,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // The admin override is an intentional product rule. Everyone else must receive a
  // successful flag response before feature-controlled UI or behavior can be enabled.
  const status: FeatureFlagStatus = isAdmin
    ? 'adminOverride'
    : error
      ? 'error'
      : flags
        ? 'ready'
        : 'loading';

  const isFeatureEnabled = (feature: keyof Omit<FeatureFlags, 'id' | 'updatedAt'>): boolean => {
    if (isAdmin) return true;
    return status === 'ready' && flags?.[feature] === true;
  };

  return {
    flags,
    isLoading,
    error,
    refetch,
    isFeatureEnabled,
    isAdmin,
    status,
  };
}
