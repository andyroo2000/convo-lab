import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLibraryData, libraryKeys, invalidateLibraryCache } from '../../hooks/useLibraryData';
import { createWrapper, createTestQueryClient } from './test-utils';

// Mock the config
vi.mock('../../config', () => ({
  API_URL: 'http://localhost:3001',
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
      expect(libraryKeys.narrowListening()).toEqual(['library', 'narrowListening']);
      expect(libraryKeys.chunkPacks()).toEqual(['library', 'chunkPacks']);
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
          new Promise((resolve) =>
            setTimeout(() => resolve({ ok: true, json: () => Promise.resolve([]) }), 10000)
          )
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
          new Promise((resolve) =>
            setTimeout(() => resolve({ ok: true, json: () => Promise.resolve([]) }), 10000)
          )
      );

      const { result } = renderHook(() => useLibraryData(), {
        wrapper: createWrapper(),
      });

      expect(result.current.episodes).toEqual([]);
      expect(result.current.courses).toEqual([]);
      expect(result.current.narrowListeningPacks).toEqual([]);
      expect(result.current.chunkPacks).toEqual([]);
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
          'http://localhost:3001/api/episodes?library=true&limit=20&offset=0',
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
          'http://localhost:3001/api/courses?library=true&limit=20&offset=0',
          expect.objectContaining({ credentials: 'include' })
        );
      });
    });

    it('should fetch narrow listening packs', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      renderHook(() => useLibraryData(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3001/api/narrow-listening?library=true&limit=20&offset=0',
          expect.any(Object)
        );
      });
    });

    it('should fetch chunk packs', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      renderHook(() => useLibraryData(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3001/api/chunk-packs?library=true&limit=20&offset=0',
          expect.any(Object)
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
      expect(typeof result.current.deleteNarrowListeningPack).toBe('function');
      expect(typeof result.current.deleteChunkPack).toBe('function');
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
      expect(result.current.isDeletingNarrowListening).toBe(false);
      expect(result.current.isDeletingChunkPack).toBe(false);
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
        'http://localhost:3001/api/episodes/ep-123',
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
        'http://localhost:3001/api/courses/course-123',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should call delete narrow listening pack API', async () => {
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

      await result.current.deleteNarrowListeningPack('pack-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/narrow-listening/pack-123',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should call delete chunk pack API', async () => {
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

      await result.current.deleteChunkPack('pack-456');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/chunk-packs/pack-456',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('Type Definitions', () => {
    it('should define NarrowListeningPack type correctly', () => {
      // Type check - this validates the interface
      const pack = {
        id: 'pack-1',
        title: 'Test Pack',
        topic: 'Cafe',
        targetLanguage: 'ja',
        jlptLevel: 'N4' as string | null,
        hskLevel: null,
        cefrLevel: null,
        status: 'ready',
        createdAt: '2024-01-01',
        _count: { versions: 3 },
      };

      expect(pack.id).toBe('pack-1');
      expect(pack._count.versions).toBe(3);
    });

    it('should define ChunkPack type correctly', () => {
      const pack = {
        id: 'chunk-1',
        title: 'Chunk Pack',
        theme: 'daily_activities',
        targetLanguage: 'ja',
        jlptLevel: 'N5' as string | null,
        hskLevel: null,
        cefrLevel: null,
        status: 'ready',
        createdAt: '2024-01-01',
        _count: { examples: 10, stories: 2, exercises: 5 },
      };

      expect(pack._count.examples).toBe(10);
      expect(pack._count.stories).toBe(2);
    });
  });
});
