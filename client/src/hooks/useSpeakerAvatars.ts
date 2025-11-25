import { useQuery } from '@tanstack/react-query';
import { API_URL } from '../config';

export interface SpeakerAvatar {
  id: string;
  filename: string;
  croppedUrl: string;
  originalUrl: string;
  language: string;
  gender: string;
  tone: string;
}

// Query key for avatar cache
export const avatarKeys = {
  all: ['avatars'] as const,
  speakers: () => [...avatarKeys.all, 'speakers'] as const,
};

async function fetchSpeakerAvatars(): Promise<SpeakerAvatar[]> {
  const response = await fetch(`${API_URL}/api/admin/avatars/speakers`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch speaker avatars');
  }

  return response.json();
}

export function useSpeakerAvatars() {
  const query = useQuery({
    queryKey: avatarKeys.speakers(),
    queryFn: fetchSpeakerAvatars,
    // Avatars rarely change, so cache for a long time
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour (previously cacheTime)
  });

  // Create a map for efficient lookups
  const avatarUrlMap = new Map<string, string>();
  if (query.data) {
    query.data.forEach((avatar) => {
      avatarUrlMap.set(avatar.filename, avatar.croppedUrl);
    });
  }

  return {
    avatars: query.data ?? [],
    avatarUrlMap,
    isLoading: query.isLoading,
    error: query.error,
  };
}
