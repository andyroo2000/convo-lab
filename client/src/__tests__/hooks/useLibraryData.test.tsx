import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  useLibraryData,
  libraryKeys,
  invalidateLibraryCache,
  episodeMatchesLibraryScope,
  parseLibraryContentScope,
} from '../../hooks/useLibraryData';
import { createWrapper, createTestQueryClient } from './test-utils';

// Mock the config
vi.mock('../../config', () => ({
  API_URL: 'http://localhost:8080',
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useLibraryData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('libraryKeys', () => {
    it('should generate correct query keys', () => {
      expect(libraryKeys.all).toEqual(['library']);
      expect(libraryKeys.episodes()).toEqual(['library', 'episodes']);
      expect(libraryKeys.courses()).toEqual(['library', 'courses']);
    });
  });

  describe('parseLibraryContentScope', () => {
    it.each([
      ['dialogues', 'dialogues'],
      ['scripts', 'scripts'],
      ['courses', 'courses'],
      ['all', 'all'],
      ['unknown', 'all'],
      [null, 'all'],
    ] as const)('maps %s to %s', (value, expected) => {
      expect(parseLibraryContentScope(value)).toBe(expected);
    });
  });

  describe('episodeMatchesLibraryScope', () => {
    const dialogue = { contentType: 'dialogue' } as Parameters<
      typeof episodeMatchesLibraryScope
    >[0];
    const legacyDialogue = {} as Parameters<typeof episodeMatchesLibraryScope>[0];
    const script = { contentType: 'script' } as Parameters<typeof episodeMatchesLibraryScope>[0];

    it.each([
      [dialogue, 'dialogues', true],
      [legacyDialogue, 'dialogues', true],
      [script, 'dialogues', false],
      [script, 'scripts', true],
      [dialogue, 'scripts', false],
      [script, 'all', true],
      [dialogue, 'courses', false],
    ] as const)('matches the requested library scope', (episode, scope, expected) => {
      expect(episodeMatchesLibraryScope(episode, scope)).toBe(expected);
    });
  });

  describe('invalidateLibraryCache', () => {
    it('should invalidate all library queries', () => {
      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      invalidateLibraryCache(queryClient);

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: libraryKeys.all });
    });
  });

  describe('Initial Loading', () => {
    it('should show loading state initially', () => {
      // Use a long-delayed promise instead of one that never resolves
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ ok: true, json: () => Promise.resolve([]) }), 10000);
          })
      );

      const { result } = renderHook(() => useLibraryData(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should initialize with empty arrays', () => {
      // Use a long-delayed promise instead of one that never resolves
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ ok: true, json: () => Promise.resolve([]) }), 10000);
          })
      );

      const { result } = renderHook(() => useLibraryData(), {
        wrapper: createWrapper(),
      });

      expect(result.current.episodes).toEqual([]);
      expect(result.current.courses).toEqual([]);
    });
  });

  describe('Data Fetching', () => {
    it('should fetch episodes with library=true param', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      renderHook(() => useLibraryData(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/convolab/episodes?library=true&limit=20&offset=0',
          expect.objectContaining({ credentials: 'include' })
        );
      });
    });

    it('should fetch courses with library=true param', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      renderHook(() => useLibraryData(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/convolab/courses?library=true&limit=20&offset=0',
          expect.objectContaining({ credentials: 'include' })
        );
      });
    });

    it('should return fetched data', async () => {
      const mockEpisodes = [{ id: 'ep-1', title: 'Episode 1' }];
      const mockCourses = [{ id: 'course-1', status: 'ready' }];

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/episodes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockEpisodes),
          });
        }
        if (url.includes('/courses')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockCourses),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      });

      const { result } = renderHook(() => useLibraryData(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.episodes).toEqual(mockEpisodes);
      expect(result.current.courses).toEqual(mockCourses);
    });

    it('should stay in the initial loading state until both all-scope resources resolve', async () => {
      let resolveEpisodes: ((value: unknown) => void) | undefined;
      let resolveCourses: ((value: unknown) => void) | undefined;
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/episodes')) {
          return new Promise((resolve) => {
            resolveEpisodes = resolve;
          });
        }
        return new Promise((resolve) => {
          resolveCourses = resolve;
        });
      });

      const { result } = renderHook(() => useLibraryData(), {
        wrapper: createWrapper(),
      });

      resolveEpisodes?.({ ok: true, json: () => Promise.resolve([{ id: 'episode-1' }]) });
      await waitFor(() => {
        expect(result.current.episodes).toHaveLength(1);
      });
      expect(result.current.isLoading).toBe(true);

      resolveCourses?.({ ok: true, json: () => Promise.resolve([]) });
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should only fetch courses for the courses scope', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      renderHook(() => useLibraryData(undefined, false, 'courses'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/convolab/courses?library=true&limit=20&offset=0',
          expect.objectContaining({ credentials: 'include' })
        );
      });

      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/episodes'),
        expect.anything()
      );
    });

    it.each(['dialogues', 'scripts'] as const)(
      'should only fetch episodes for the %s scope',
      async (scope) => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([]),
        });

        renderHook(() => useLibraryData(undefined, false, scope), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(mockFetch).toHaveBeenCalledWith(
            '/api/convolab/episodes?library=true&limit=20&offset=0',
            expect.objectContaining({ credentials: 'include' })
          );
        });

        expect(mockFetch).not.toHaveBeenCalledWith(
          expect.stringContaining('/courses'),
          expect.anything()
        );
      }
    );

    it('should keep existing courses visible while episodes first load after widening scope', async () => {
      let resolveEpisodes: ((value: unknown) => void) | undefined;
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/episodes')) {
          return new Promise((resolve) => {
            resolveEpisodes = resolve;
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 'course-1', status: 'ready' }]),
        });
      });

      const { result, rerender } = renderHook(
        ({ scope }) => useLibraryData(undefined, false, scope),
        {
          initialProps: { scope: 'courses' as 'all' | 'courses' },
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.courses).toHaveLength(1);
      });

      rerender({ scope: 'all' });

      expect(result.current.isLoading).toBe(false);
      resolveEpisodes?.({ ok: true, json: () => Promise.resolve([]) });
    });

    it('should require manual paging until a filtered episode is visible', async () => {
      const firstPage = Array.from({ length: 20 }, (_, index) => ({
        id: `dialogue-${String(index)}`,
        contentType: 'dialogue',
      }));
      const secondPage = [
        { id: 'script-1', contentType: 'script' },
        ...Array.from({ length: 19 }, (_, index) => ({
          id: `dialogue-next-${String(index)}`,
          contentType: 'dialogue',
        })),
      ];

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/episodes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(url.includes('offset=20') ? secondPage : firstPage),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const { result } = renderHook(() => useLibraryData(undefined, false, 'scripts'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.hasNextPage).toBe(true);
      });
      expect(result.current.shouldAutoLoadMore).toBe(false);

      await result.current.fetchNextPage();

      await waitFor(() => {
        expect(result.current.episodes).toHaveLength(40);
      });
      expect(result.current.shouldAutoLoadMore).toBe(true);
      expect(
        result.current.episodes.some((episode) => episodeMatchesLibraryScope(episode, 'scripts'))
      ).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should set error when episodes fetch fails', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/episodes')) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Failed' }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      });

      const { result } = renderHook(() => useLibraryData(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to fetch episodes');
      });
    });

    it('should surface a courses fetch failure for the courses scope', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Courses are unavailable' }),
      });

      const { result } = renderHook(() => useLibraryData(undefined, false, 'courses'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Courses are unavailable');
      });
    });
  });

  describe('showDrafts Parameter', () => {
    it('should pass status=all when showDrafts is true', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      renderHook(() => useLibraryData(undefined, true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/convolab/courses?library=true&limit=20&offset=0&status=all',
          expect.objectContaining({ credentials: 'include' })
        );
      });
    });

    it('should not pass status param when showDrafts is false', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      renderHook(() => useLibraryData(undefined, false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/convolab/courses?library=true&limit=20&offset=0',
          expect.objectContaining({ credentials: 'include' })
        );
      });
    });

    it('should not pass status param when showDrafts is undefined', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      renderHook(() => useLibraryData(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/convolab/courses?library=true&limit=20&offset=0',
          expect.objectContaining({ credentials: 'include' })
        );
      });
    });

    it('should include viewAs and status=all when both are provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      renderHook(() => useLibraryData('user-123', true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/convolab/courses?library=true&limit=20&offset=0&viewAs=user-123&status=all',
          expect.objectContaining({ credentials: 'include' })
        );
      });
    });
  });

  describe('Delete Mutations', () => {
    it('should provide delete mutation functions', () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const { result } = renderHook(() => useLibraryData(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.deleteEpisode).toBe('function');
      expect(typeof result.current.deleteCourse).toBe('function');
    });

    it('should provide mutation pending states', () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const { result } = renderHook(() => useLibraryData(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isDeletingEpisode).toBe(false);
      expect(result.current.isDeletingCourse).toBe(false);
    });

    it('should call delete episode API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const { result } = renderHook(() => useLibraryData(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({ ok: true });

      await result.current.deleteEpisode('ep-123');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/convolab/episodes/ep-123',
        expect.objectContaining({
          method: 'DELETE',
          credentials: 'include',
        })
      );
    });

    it('should call delete course API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const { result } = renderHook(() => useLibraryData(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({ ok: true });

      await result.current.deleteCourse('course-123');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/convolab/courses/course-123',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });
});
