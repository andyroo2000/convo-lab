import { useInfiniteQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import { Episode, Course } from '../types';
import { API_URL } from '../config';

// Library-specific types with _count instead of full relations
export type LibraryCourse = Omit<Course, 'lessons'> & {
  courseEpisodes?: Array<{
    episode?: {
      dialogue?: {
        sentences?: Array<{ id: string }>;
      };
    };
  }>;
  _count?: {
    coreItems: number;
  };
};

// Query keys for cache management
export const libraryKeys = {
  all: ['library'] as const,
  episodes: () => [...libraryKeys.all, 'episodes'] as const,
  courses: () => [...libraryKeys.all, 'courses'] as const,
};

// Invalidate library cache - call this after creating new content
export function invalidateLibraryCache(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: libraryKeys.all });
}

// Hook version for components
export function useInvalidateLibrary() {
  const queryClient = useQueryClient();
  return () => invalidateLibraryCache(queryClient);
}

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

async function fetchCourses(
  offset: number = 0,
  viewAsUserId?: string,
  showDrafts?: boolean
): Promise<LibraryCourse[]> {
  const params = new URLSearchParams({
    library: 'true',
    limit: '20',
    offset: String(offset),
  });
  if (viewAsUserId) params.append('viewAs', viewAsUserId);
  if (showDrafts) params.append('status', 'all');

  const response = await fetch(`${API_URL}/api/courses?${params}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch courses');
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

// Main hook
export function useLibraryData(viewAsUserId?: string, showDrafts?: boolean) {
  const queryClient = useQueryClient();

  // Infinite queries - all run in parallel automatically
  const episodesQuery = useInfiniteQuery({
    queryKey: [...libraryKeys.episodes(), viewAsUserId],
    queryFn: ({ pageParam = 0 }) => fetchEpisodes(pageParam, viewAsUserId),
    getNextPageParam: (lastPage, allPages) =>
      // If last page has 20 items, there might be more
      lastPage.length === 20 ? allPages.length * 20 : undefined,
    initialPageParam: 0,
  });

  const coursesQuery = useInfiniteQuery({
    queryKey: [...libraryKeys.courses(), viewAsUserId, showDrafts],
    queryFn: ({ pageParam = 0 }) => fetchCourses(pageParam, viewAsUserId, showDrafts),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === 20 ? allPages.length * 20 : undefined,
    initialPageParam: 0,
    // Poll every 5 seconds while any course is generating
    refetchInterval: (query) => {
      const allCourses = query.state.data?.pages.flat() ?? [];
      const hasGenerating = allCourses.some((c) => c.status === 'generating');
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

  // Combined loading state - only show loading on initial load
  const isLoading = episodesQuery.isLoading || coursesQuery.isLoading;

  // Error state - only show error if episodes fail (primary content)
  const error = episodesQuery.error?.message || null;

  // Flatten paginated data
  const episodes = episodesQuery.data?.pages.flat() ?? [];
  const courses = coursesQuery.data?.pages.flat() ?? [];

  // Check if we're fetching more data
  const isFetchingNextPage = episodesQuery.isFetchingNextPage || coursesQuery.isFetchingNextPage;

  // Check if there's more data to load
  const hasNextPage = episodesQuery.hasNextPage || coursesQuery.hasNextPage;

  // Fetch next page for all queries
  const fetchNextPage = () => {
    if (episodesQuery.hasNextPage) episodesQuery.fetchNextPage();
    if (coursesQuery.hasNextPage) coursesQuery.fetchNextPage();
  };

  return {
    // Data
    episodes,
    courses,

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

    // Mutation states for UI feedback
    isDeletingEpisode: deleteEpisodeMutation.isPending,
    isDeletingCourse: deleteCourseMutation.isPending,
  };
}
