import { useQuery } from '@tanstack/react-query';
import { API_URL } from '../config';
import { useAuth } from '../contexts/AuthContext';

export interface FeatureFlags {
  id: string;
  dialoguesEnabled: boolean;
  audioCourseEnabled: boolean;
  narrowListeningEnabled: boolean;
  processingInstructionEnabled: boolean;
  lexicalChunksEnabled: boolean;
  flashcardsEnabled: boolean;
  updatedAt: string;
}

async function fetchFeatureFlags(): Promise<FeatureFlags> {
  const response = await fetch(`${API_URL}/api/feature-flags`, {
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
  } = useQuery({
    queryKey: ['featureFlags'],
    queryFn: fetchFeatureFlags,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Helper function to check if a feature is enabled
  // Admins always see everything
  const isFeatureEnabled = (feature: keyof Omit<FeatureFlags, 'id' | 'updatedAt'>): boolean => {
    if (isAdmin) return true;
    if (!flags) return true; // Default to enabled if flags haven't loaded
    return flags[feature];
  };

  return {
    flags,
    isLoading,
    error,
    isFeatureEnabled,
    isAdmin,
  };
}
