import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCourse, courseKeys } from '../../hooks/useCourse';
import { createWrapper, createTestQueryClient } from './test-utils';

// Mock the config
vi.mock('../../config', () => ({
  API_URL: 'http://localhost:3001',
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useCourse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('courseKeys', () => {
    it('should generate correct query keys', () => {
      expect(courseKeys.all).toEqual(['courses']);
      expect(courseKeys.detail('course-123')).toEqual(['courses', 'detail', 'course-123']);
      expect(courseKeys.status('course-123')).toEqual(['courses', 'status', 'course-123']);
    });
  });

  describe('Initial State', () => {
    it('should not fetch when courseId is undefined', () => {
      const { result } = renderHook(() => useCourse(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.course).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should show loading state when fetching', () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useCourse('course-123'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('Data Fetching', () => {
    it('should fetch course by id', async () => {
      const mockCourse = {
        id: 'course-123',
        episodeId: 'ep-1',
        status: 'ready',
        lessons: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCourse),
      });

      const { result } = renderHook(() => useCourse('course-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.course).toEqual(mockCourse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/courses/course-123',
        expect.objectContaining({ credentials: 'include' })
      );
    });

    it('should set error on fetch failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Not found' }),
      });

      const { result } = renderHook(() => useCourse('course-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to load course');
      });
    });
  });

  describe('Status Polling', () => {
    it('should poll status when course is generating', async () => {
      const mockCourse = {
        id: 'course-123',
        status: 'generating',
        lessons: [],
      };

      const mockStatus = {
        id: 'course-123',
        status: 'generating',
        progress: { step: 'generating', progress: 50 },
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockStatus),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockCourse),
        });
      });

      const { result } = renderHook(() => useCourse('course-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.course?.status).toBe('generating');
      });

      // Verify status endpoint was called
      await waitFor(() => {
        const statusCalls = mockFetch.mock.calls.filter((call: string[]) =>
          call[0].includes('/status')
        );
        expect(statusCalls.length).toBeGreaterThan(0);
      });
    });

    it('should not poll status when course is ready', async () => {
      const mockCourse = {
        id: 'course-123',
        status: 'ready',
        lessons: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCourse),
      });

      renderHook(() => useCourse('course-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      // Wait a bit and verify no status endpoint calls
      await new Promise((resolve) => setTimeout(resolve, 100));

      const statusCalls = mockFetch.mock.calls.filter((call: string[]) =>
        call[0].includes('/status')
      );
      expect(statusCalls.length).toBe(0);
    });

    it('should return generation progress', async () => {
      const mockCourse = {
        id: 'course-123',
        status: 'generating',
      };

      const mockStatus = {
        status: 'generating',
        progress: { step: 'audio', progress: 75 },
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockStatus),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockCourse),
        });
      });

      const { result } = renderHook(() => useCourse('course-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.generationProgress).toEqual({
          step: 'audio',
          progress: 75,
        });
      });
    });
  });

  describe('Update Mutation', () => {
    it('should provide updateCourse function', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'course-123', status: 'ready' }),
      });

      const { result } = renderHook(() => useCourse('course-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.updateCourse).toBe('function');
    });

    it('should call update API with PATCH', async () => {
      const mockCourse = { id: 'course-123', status: 'ready', title: 'Original' };
      const updatedCourse = { id: 'course-123', status: 'ready', title: 'Updated Title' };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCourse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(updatedCourse),
        });

      const { result } = renderHook(() => useCourse('course-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.updateCourse({ title: 'Updated Title' });
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/courses/course-123',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Updated Title' }),
        })
      );
    });

    it('should track updating state', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'course-123' }),
      });

      const { result } = renderHook(() => useCourse('course-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isUpdating).toBe(false);
    });
  });

  describe('Return Values', () => {
    it('should return all expected properties', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'course-123', status: 'ready' }),
      });

      const { result } = renderHook(() => useCourse('course-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current).toHaveProperty('course');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('generationProgress');
      expect(result.current).toHaveProperty('updateCourse');
      expect(result.current).toHaveProperty('isUpdating');
    });

    it('should return null course when courseId is undefined', () => {
      const { result } = renderHook(() => useCourse(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.course).toBeNull();
    });

    it('should return null error when no error occurs', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'course-123' }),
      });

      const { result } = renderHook(() => useCourse('course-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeNull();
    });

    it('should return null generationProgress when not generating', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'course-123', status: 'ready' }),
      });

      const { result } = renderHook(() => useCourse('course-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.generationProgress).toBeNull();
    });
  });
});
