import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Course, CourseStatusResponse } from '../types';
import { courseApi, readCourseApiError } from '../lib/courseApi';

// Query keys
export const courseKeys = {
  all: ['courses'] as const,
  detail: (id: string, viewAsUserId?: string) =>
    [...courseKeys.all, 'detail', id, viewAsUserId ?? null] as const,
  status: (id: string, viewAsUserId?: string) =>
    [...courseKeys.all, 'status', id, viewAsUserId ?? null] as const,
};

async function fetchCourse(courseId: string, viewAsUserId?: string): Promise<Course> {
  const params = new URLSearchParams();
  if (viewAsUserId) params.append('viewAs', viewAsUserId);

  const queryString = params.toString();
  const url = `${courseApi.member(courseId)}${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(await readCourseApiError(response, 'Failed to load course'));
  }

  return response.json();
}

async function fetchCourseStatus(
  courseId: string,
  viewAsUserId?: string
): Promise<CourseStatusResponse> {
  const params = new URLSearchParams();
  if (viewAsUserId) params.append('viewAs', viewAsUserId);

  const queryString = params.toString();
  const url = `${courseApi.operation(courseId, 'status')}${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(await readCourseApiError(response, 'Failed to check course status'));
  }

  return response.json();
}

async function updateCourseRequest(
  courseId: string,
  updates: { title?: string; description?: string },
  viewAsUserId?: string
): Promise<void> {
  const params = new URLSearchParams();
  if (viewAsUserId) params.append('viewAs', viewAsUserId);

  const queryString = params.toString();
  const url = `${courseApi.member(courseId)}${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error(await readCourseApiError(response, 'Failed to update course'));
  }
}

export function useCourse(courseId: string | undefined, viewAsUserId?: string) {
  const queryClient = useQueryClient();

  // Main course query
  const courseQuery = useQuery({
    queryKey: courseKeys.detail(courseId!, viewAsUserId),
    queryFn: () => fetchCourse(courseId!, viewAsUserId),
    enabled: !!courseId,
  });

  const course = courseQuery.data;
  const isGenerating = course?.status === 'generating';

  // Status polling query - only active when course is generating
  const statusQuery = useQuery({
    queryKey: courseKeys.status(courseId!, viewAsUserId),
    queryFn: () => fetchCourseStatus(courseId!, viewAsUserId),
    enabled: !!courseId && isGenerating,
    refetchInterval: isGenerating ? 5000 : false, // Poll every 5 seconds while generating
  });

  // When status changes to ready/error, refetch the course
  const terminalStatus =
    statusQuery.data?.status === 'ready' || statusQuery.data?.status === 'error'
      ? statusQuery.data.status
      : null;

  useEffect(() => {
    if (!courseId || !isGenerating || !terminalStatus) return;

    // Refresh once when polling reaches a terminal state. Performing this
    // invalidation during render caused every render to start another request.
    queryClient.invalidateQueries({
      queryKey: courseKeys.detail(courseId, viewAsUserId),
    });
  }, [courseId, isGenerating, queryClient, terminalStatus, viewAsUserId]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (updates: { title?: string; description?: string }) =>
      updateCourseRequest(courseId!, updates, viewAsUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: courseKeys.detail(courseId!, viewAsUserId),
      });
    },
  });

  return {
    course: courseQuery.data ?? null,
    isLoading: courseQuery.isLoading,
    error: courseQuery.error?.message ?? null,
    generationProgress: statusQuery.data?.progress ?? null,
    updateCourse: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}
