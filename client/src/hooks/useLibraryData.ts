import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import { Episode, Course } from '../types';
import { API_URL } from '../config';

// Invalidate library cache - call this after creating new content
export function invalidateLibraryCache(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: libraryKeys.all });
}

// Hook version for components
export function useInvalidateLibrary() {
  const queryClient = useQueryClient();
  return () => invalidateLibraryCache(queryClient);
}

// Library-specific types with _count instead of full relations
export type LibraryCourse = Omit<Course, 'lessons' | 'courseEpisodes'> & {
  _count?: {
    lessons: number;
  };
};

export interface NarrowListeningPack {
  id: string;
  title: string;
  topic: string;
  targetLanguage: string;
  jlptLevel: string | null;
  hskLevel: string | null;
  status: string;
  createdAt: string;
  _count: {
    versions: number;
  };
}

export interface ChunkPack {
  id: string;
  title: string;
  theme: string;
  targetLanguage: string;
  jlptLevel: string | null;
  hskLevel: string | null;
  status: string;
  createdAt: string;
  _count: {
    examples: number;
    stories: number;
    exercises: number;
  };
}

// Query keys for cache management
export const libraryKeys = {
  all: ['library'] as const,
  episodes: () => [...libraryKeys.all, 'episodes'] as const,
  courses: () => [...libraryKeys.all, 'courses'] as const,
  narrowListening: () => [...libraryKeys.all, 'narrowListening'] as const,
  chunkPacks: () => [...libraryKeys.all, 'chunkPacks'] as const,
};

// Fetch functions
async function fetchEpisodes(): Promise<Episode[]> {
  const response = await fetch(`${API_URL}/api/episodes?library=true`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch episodes');
  }
  return response.json();
}

async function fetchCourses(): Promise<LibraryCourse[]> {
  const response = await fetch(`${API_URL}/api/courses?library=true`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch courses');
  }
  return response.json();
}

async function fetchNarrowListeningPacks(): Promise<NarrowListeningPack[]> {
  const response = await fetch(`${API_URL}/api/narrow-listening?library=true`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch narrow listening packs');
  }
  return response.json();
}

async function fetchChunkPacks(): Promise<ChunkPack[]> {
  const response = await fetch(`${API_URL}/api/chunk-packs?library=true`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch chunk packs');
  }
  return response.json();
}

// Delete functions
async function deleteEpisodeRequest(episodeId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/episodes/${episodeId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to delete episode');
  }
}

async function deleteCourseRequest(courseId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/courses/${courseId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to delete course');
  }
}

async function deleteNarrowListeningPackRequest(packId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/narrow-listening/${packId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to delete pack');
  }
}

async function deleteChunkPackRequest(packId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/chunk-packs/${packId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to delete chunk pack');
  }
}

// Main hook
export function useLibraryData() {
  const queryClient = useQueryClient();

  // Queries - all run in parallel automatically
  const episodesQuery = useQuery({
    queryKey: libraryKeys.episodes(),
    queryFn: fetchEpisodes,
  });

  const coursesQuery = useQuery({
    queryKey: libraryKeys.courses(),
    queryFn: fetchCourses,
    // Poll every 5 seconds while any course is generating
    refetchInterval: (query) => {
      const hasGenerating = query.state.data?.some(c => c.status === 'generating');
      return hasGenerating ? 5000 : false;
    },
  });

  const narrowListeningQuery = useQuery({
    queryKey: libraryKeys.narrowListening(),
    queryFn: fetchNarrowListeningPacks,
  });

  const chunkPacksQuery = useQuery({
    queryKey: libraryKeys.chunkPacks(),
    queryFn: fetchChunkPacks,
    // Poll every 5 seconds while any chunk pack is generating
    refetchInterval: (query) => {
      const hasGenerating = query.state.data?.some(cp => cp.status === 'generating');
      return hasGenerating ? 5000 : false;
    },
  });

  // Delete mutations with optimistic updates
  const deleteEpisodeMutation = useMutation({
    mutationFn: deleteEpisodeRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.episodes() });
    },
  });

  const deleteCourseMutation = useMutation({
    mutationFn: deleteCourseRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.courses() });
    },
  });

  const deleteNarrowListeningMutation = useMutation({
    mutationFn: deleteNarrowListeningPackRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.narrowListening() });
    },
  });

  const deleteChunkPackMutation = useMutation({
    mutationFn: deleteChunkPackRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.chunkPacks() });
    },
  });

  // Combined loading state - only show loading on initial load
  const isLoading =
    episodesQuery.isLoading ||
    coursesQuery.isLoading ||
    narrowListeningQuery.isLoading ||
    chunkPacksQuery.isLoading;

  // Error state - only show error if episodes fail (primary content)
  const error = episodesQuery.error?.message || null;

  return {
    // Data
    episodes: episodesQuery.data ?? [],
    courses: coursesQuery.data ?? [],
    narrowListeningPacks: narrowListeningQuery.data ?? [],
    chunkPacks: chunkPacksQuery.data ?? [],

    // Status
    isLoading,
    error,

    // Delete actions
    deleteEpisode: deleteEpisodeMutation.mutateAsync,
    deleteCourse: deleteCourseMutation.mutateAsync,
    deleteNarrowListeningPack: deleteNarrowListeningMutation.mutateAsync,
    deleteChunkPack: deleteChunkPackMutation.mutateAsync,

    // Mutation states for UI feedback
    isDeletingEpisode: deleteEpisodeMutation.isPending,
    isDeletingCourse: deleteCourseMutation.isPending,
    isDeletingNarrowListening: deleteNarrowListeningMutation.isPending,
    isDeletingChunkPack: deleteChunkPackMutation.isPending,
  };
}
