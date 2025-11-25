import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Course, CourseStatusResponse } from '../types';
import { API_URL } from '../config';

// Query keys
export const courseKeys = {
  all: ['courses'] as const,
  detail: (id: string) => [...courseKeys.all, 'detail', id] as const,
  status: (id: string) => [...courseKeys.all, 'status', id] as const,
};

async function fetchCourse(courseId: string): Promise<Course> {
  const response = await fetch(`${API_URL}/api/courses/${courseId}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to load course');
  }

  return response.json();
}

async function fetchCourseStatus(courseId: string): Promise<CourseStatusResponse> {
  const response = await fetch(`${API_URL}/api/courses/${courseId}/status`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to check course status');
  }

  return response.json();
}

async function updateCourseRequest(
  courseId: string,
  updates: { title?: string; description?: string }
): Promise<Course> {
  const response = await fetch(`${API_URL}/api/courses/${courseId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error('Failed to update course');
  }

  return response.json();
}

export function useCourse(courseId: string | undefined) {
  const queryClient = useQueryClient();

  // Main course query
  const courseQuery = useQuery({
    queryKey: courseKeys.detail(courseId!),
    queryFn: () => fetchCourse(courseId!),
    enabled: !!courseId,
  });

  const course = courseQuery.data;
  const isGenerating = course?.status === 'generating';

  // Status polling query - only active when course is generating
  const statusQuery = useQuery({
    queryKey: courseKeys.status(courseId!),
    queryFn: () => fetchCourseStatus(courseId!),
    enabled: !!courseId && isGenerating,
    refetchInterval: isGenerating ? 5000 : false, // Poll every 5 seconds while generating
  });

  // When status changes to ready/error, refetch the course
  const status = statusQuery.data;
  if (status && (status.status === 'ready' || status.status === 'error')) {
    // Invalidate the course query to get fresh data
    queryClient.invalidateQueries({ queryKey: courseKeys.detail(courseId!) });
  }

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (updates: { title?: string; description?: string }) =>
      updateCourseRequest(courseId!, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: courseKeys.detail(courseId!) });
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
