import { useInfiniteQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
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
  cefrLevel: string | null;
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
  cefrLevel: string | null;
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

// Fetch functions with pagination support
async function fetchEpisodes(offset: number = 0, viewAsUserId?: string): Promise<Episode[]> {
  const params = new URLSearchParams({
    library: 'true',
    limit: '20',
    offset: String(offset),
  });
  if (viewAsUserId) params.append('viewAs', viewAsUserId);

  const response = await fetch(`${API_URL}/api/episodes?${params}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch episodes');
  }
  return response.json();
}

async function fetchCourses(offset: number = 0, viewAsUserId?: string): Promise<LibraryCourse[]> {
  const params = new URLSearchParams({
    library: 'true',
    limit: '20',
    offset: String(offset),
  });
  if (viewAsUserId) params.append('viewAs', viewAsUserId);

  const response = await fetch(`${API_URL}/api/courses?${params}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch courses');
  }
  return response.json();
}

async function fetchNarrowListeningPacks(offset: number = 0, viewAsUserId?: string): Promise<NarrowListeningPack[]> {
  const params = new URLSearchParams({
    library: 'true',
    limit: '20',
    offset: String(offset),
  });
  if (viewAsUserId) params.append('viewAs', viewAsUserId);

  const response = await fetch(`${API_URL}/api/narrow-listening?${params}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch narrow listening packs');
  }
  return response.json();
}

async function fetchChunkPacks(offset: number = 0, viewAsUserId?: string): Promise<ChunkPack[]> {
  const params = new URLSearchParams({
    library: 'true',
    limit: '20',
    offset: String(offset),
  });
  if (viewAsUserId) params.append('viewAs', viewAsUserId);

  const response = await fetch(`${API_URL}/api/chunk-packs?${params}`, {
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
export function useLibraryData(viewAsUserId?: string) {
  const queryClient = useQueryClient();

  // Infinite queries - all run in parallel automatically
  const episodesQuery = useInfiniteQuery({
    queryKey: [...libraryKeys.episodes(), viewAsUserId],
    queryFn: ({ pageParam = 0 }) => fetchEpisodes(pageParam, viewAsUserId),
    getNextPageParam: (lastPage, allPages) => 
      // If last page has 20 items, there might be more
       lastPage.length === 20 ? allPages.length * 20 : undefined
    ,
    initialPageParam: 0,
  });

  const coursesQuery = useInfiniteQuery({
    queryKey: [...libraryKeys.courses(), viewAsUserId],
    queryFn: ({ pageParam = 0 }) => fetchCourses(pageParam, viewAsUserId),
    getNextPageParam: (lastPage, allPages) => lastPage.length === 20 ? allPages.length * 20 : undefined,
    initialPageParam: 0,
    // Poll every 5 seconds while any course is generating
    refetchInterval: (query) => {
      const allCourses = query.state.data?.pages.flat() ?? [];
      const hasGenerating = allCourses.some(c => c.status === 'generating');
      return hasGenerating ? 5000 : false;
    },
  });

  const narrowListeningQuery = useInfiniteQuery({
    queryKey: [...libraryKeys.narrowListening(), viewAsUserId],
    queryFn: ({ pageParam = 0 }) => fetchNarrowListeningPacks(pageParam, viewAsUserId),
    getNextPageParam: (lastPage, allPages) => lastPage.length === 20 ? allPages.length * 20 : undefined,
    initialPageParam: 0,
  });

  const chunkPacksQuery = useInfiniteQuery({
    queryKey: [...libraryKeys.chunkPacks(), viewAsUserId],
    queryFn: ({ pageParam = 0 }) => fetchChunkPacks(pageParam, viewAsUserId),
    getNextPageParam: (lastPage, allPages) => lastPage.length === 20 ? allPages.length * 20 : undefined,
    initialPageParam: 0,
    // Poll every 5 seconds while any chunk pack is generating
    refetchInterval: (query) => {
      const allPacks = query.state.data?.pages.flat() ?? [];
      const hasGenerating = allPacks.some(cp => cp.status === 'generating');
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

  // Flatten paginated data
  const episodes = episodesQuery.data?.pages.flat() ?? [];
  const courses = coursesQuery.data?.pages.flat() ?? [];
  const narrowListeningPacks = narrowListeningQuery.data?.pages.flat() ?? [];
  const chunkPacks = chunkPacksQuery.data?.pages.flat() ?? [];

  // Check if we're fetching more data
  const isFetchingNextPage =
    episodesQuery.isFetchingNextPage ||
    coursesQuery.isFetchingNextPage ||
    narrowListeningQuery.isFetchingNextPage ||
    chunkPacksQuery.isFetchingNextPage;

  // Check if there's more data to load
  const hasNextPage =
    episodesQuery.hasNextPage ||
    coursesQuery.hasNextPage ||
    narrowListeningQuery.hasNextPage ||
    chunkPacksQuery.hasNextPage;

  // Fetch next page for all queries
  const fetchNextPage = () => {
    if (episodesQuery.hasNextPage) episodesQuery.fetchNextPage();
    if (coursesQuery.hasNextPage) coursesQuery.fetchNextPage();
    if (narrowListeningQuery.hasNextPage) narrowListeningQuery.fetchNextPage();
    if (chunkPacksQuery.hasNextPage) chunkPacksQuery.fetchNextPage();
  };

  return {
    // Data
    episodes,
    courses,
    narrowListeningPacks,
    chunkPacks,

    // Status
    isLoading,
    error,

    // Pagination
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,

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
