import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  QueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { Episode, Course } from '../types';
import { courseApi, readCourseApiError } from '../lib/courseApi';
import { episodeApi, readEpisodeApiError } from '../lib/episodeApi';

// Library-specific types expose compact relation summaries instead of full relations.
export type LibraryEpisode = Omit<Episode, 'dialogue'> & {
  dialogue?: {
    turnCount?: number;
    sentences?: Array<{ id: string }>;
    speakers?: Array<{
      proficiency: string;
    }>;
  } | null;
};

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

export type LibraryContentScope = 'all' | 'dialogues' | 'scripts' | 'courses';

export function parseLibraryContentScope(value: string | null): LibraryContentScope {
  return value === 'dialogues' || value === 'scripts' || value === 'courses' ? value : 'all';
}

export function episodeMatchesLibraryScope(
  episode: Pick<Episode, 'contentType'>,
  contentScope: LibraryContentScope
): boolean {
  if (contentScope === 'all') return true;
  if (contentScope === 'courses') return false;
  return (
    (episode.contentType ?? 'dialogue') === (contentScope === 'dialogues' ? 'dialogue' : 'script')
  );
}

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
async function fetchEpisodes(offset: number = 0, viewAsUserId?: string): Promise<LibraryEpisode[]> {
  const params = new URLSearchParams({
    library: 'true',
    limit: '20',
    offset: String(offset),
  });
  if (viewAsUserId) params.append('viewAs', viewAsUserId);

  const response = await fetch(`${episodeApi.collection}?${params}`, {
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

  const response = await fetch(`${courseApi.collection}?${params}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(await readCourseApiError(response, 'Failed to fetch courses'));
  }
  return response.json();
}

// Delete functions
async function deleteEpisodeRequest(episodeId: string): Promise<void> {
  const response = await fetch(episodeApi.member(episodeId), {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(await readEpisodeApiError(response, 'Failed to delete episode'));
  }
}

async function deleteCourseRequest(courseId: string): Promise<void> {
  const response = await fetch(courseApi.member(courseId), {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(await readCourseApiError(response, 'Failed to delete course'));
  }
}

// Main hook
export function useLibraryData(
  viewAsUserId?: string,
  showDrafts?: boolean,
  contentScope: LibraryContentScope = 'all'
) {
  const queryClient = useQueryClient();
  const includeEpisodes = contentScope !== 'courses';
  const includeCourses = contentScope === 'all' || contentScope === 'courses';
  const episodesQueryKey = [...libraryKeys.episodes(), viewAsUserId] as const;
  const coursesQueryKey = [...libraryKeys.courses(), viewAsUserId, showDrafts] as const;
  const hasCachedEpisodes = Boolean(
    queryClient.getQueryData<InfiniteData<LibraryEpisode[]>>(episodesQueryKey)?.pages.length
  );
  const hasCachedCourses = Boolean(
    queryClient.getQueryData<InfiniteData<LibraryCourse[]>>(coursesQueryKey)?.pages.length
  );
  const previousContentScopeRef = useRef(contentScope);
  const preserveVisibleContentRef = useRef(false);
  if (previousContentScopeRef.current !== contentScope) {
    preserveVisibleContentRef.current = hasCachedEpisodes || hasCachedCourses;
    previousContentScopeRef.current = contentScope;
  }

  // Infinite queries - all run in parallel automatically
  const episodesQuery = useInfiniteQuery({
    queryKey: episodesQueryKey,
    queryFn: ({ pageParam = 0 }) => fetchEpisodes(pageParam, viewAsUserId),
    getNextPageParam: (lastPage, allPages) =>
      // If last page has 20 items, there might be more
      lastPage.length === 20 ? allPages.length * 20 : undefined,
    initialPageParam: 0,
    enabled: includeEpisodes,
  });

  const coursesQuery = useInfiniteQuery({
    queryKey: coursesQueryKey,
    queryFn: ({ pageParam = 0 }) => fetchCourses(pageParam, viewAsUserId, showDrafts),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === 20 ? allPages.length * 20 : undefined,
    initialPageParam: 0,
    enabled: includeCourses,
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
  const { isLoading: episodesLoading } = episodesQuery;
  const { isLoading: coursesLoading } = coursesQuery;
  let isLoading = episodesLoading;
  if (contentScope === 'all') {
    isLoading = !preserveVisibleContentRef.current && (episodesLoading || coursesLoading);
  } else if (contentScope === 'courses') {
    isLoading = coursesLoading;
  }
  if (!episodesLoading && !coursesLoading) {
    preserveVisibleContentRef.current = false;
  }

  // The combined view can still show episodes when the secondary course read fails, but a
  // course-only view must not turn that same failure into a convincing empty state.
  const error =
    contentScope === 'courses'
      ? coursesQuery.error?.message || null
      : episodesQuery.error?.message || null;

  // Flatten paginated data
  const episodes = episodesQuery.data?.pages.flat() ?? [];
  const courses = coursesQuery.data?.pages.flat() ?? [];

  // Check if we're fetching more data
  const isFetchingNextPage =
    (includeEpisodes && episodesQuery.isFetchingNextPage) ||
    (includeCourses && coursesQuery.isFetchingNextPage);

  // Check if there's more data to load
  const hasNextPage =
    (includeEpisodes && episodesQuery.hasNextPage) || (includeCourses && coursesQuery.hasNextPage);
  const fetchNextEpisodesPage = episodesQuery.fetchNextPage;
  const fetchNextCoursesPage = coursesQuery.fetchNextPage;
  const refetchEpisodes = episodesQuery.refetch;
  const refetchCourses = coursesQuery.refetch;

  // Keep page fetching stable across unrelated query-state updates.
  const fetchNextPage = useCallback(() => {
    if (includeEpisodes && episodesQuery.hasNextPage) fetchNextEpisodesPage();
    if (includeCourses && coursesQuery.hasNextPage) fetchNextCoursesPage();
  }, [
    coursesQuery.hasNextPage,
    episodesQuery.hasNextPage,
    fetchNextCoursesPage,
    fetchNextEpisodesPage,
    includeCourses,
    includeEpisodes,
  ]);

  const retry = useCallback(() => {
    if (includeEpisodes) refetchEpisodes();
    if (includeCourses) refetchCourses();
  }, [includeCourses, includeEpisodes, refetchCourses, refetchEpisodes]);

  const hasVisibleEpisodes = episodes.some((episode) =>
    episodeMatchesLibraryScope(episode, contentScope)
  );
  const hasVisibleItems = hasVisibleEpisodes || (includeCourses && courses.length > 0);
  const shouldAutoLoadMore = Boolean(hasNextPage && hasVisibleItems);

  return {
    // Data
    episodes,
    courses,

    // Status
    isLoading,
    error,
    retry,

    // Pagination
    hasNextPage,
    shouldAutoLoadMore,
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
