import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';

export interface FeatureFlags {
  id?: string;

  flashcardsEnabled: boolean;
  readingsEnabled?: boolean;
  studyTimeEnabled?: boolean;
  learnEnabled?: boolean;
  updatedAt?: string;
}

export type FeatureFlagStatus = 'loading' | 'ready' | 'error' | 'adminOverride';

async function fetchFeatureFlags(): Promise<FeatureFlags> {
  const response = await fetch('/api/convolab/feature-availability', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch feature flags');
  }
  return response.json();
}

const identityKey = (user: { id: string } | null | undefined) => user?.id ?? 'anonymous';

export function useFeatureFlags() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const {
    data: flags,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['featureFlags', identityKey(user)],
    queryFn: fetchFeatureFlags,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  // The admin override is an intentional product rule. Everyone else must receive a
  // successful flag response before feature-controlled UI or behavior can be enabled.
  let status: FeatureFlagStatus = 'loading';
  if (isAdmin) {
    status = 'adminOverride';
  } else if (error) {
    status = 'error';
  } else if (flags) {
    status = 'ready';
  }

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
