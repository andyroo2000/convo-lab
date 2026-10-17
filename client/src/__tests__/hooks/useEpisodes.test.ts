import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEpisodes } from '../../hooks/useEpisodes';

// Mock the config
vi.mock('../../config', () => ({
  API_URL: 'http://localhost:8080',
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useEpisodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('Initial State', () => {
    it('should initialize with loading false and no error', () => {
      const { result } = renderHook(() => useEpisodes());

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should return all expected functions', () => {
      const { result } = renderHook(() => useEpisodes());

      expect(typeof result.current.getEpisode).toBe('function');
      expect(typeof result.current.deleteEpisode).toBe('function');
    });
  });

  describe('getEpisode', () => {
    it('should fetch episode by id', async () => {
      const mockEpisode = { id: 'ep-123', title: 'Test Episode' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEpisode),
      });

      const { result } = renderHook(() => useEpisodes());

      let episode: typeof mockEpisode | null = null;
      await act(async () => {
        episode = await result.current.getEpisode('ep-123');
      });

      expect(episode).toEqual(mockEpisode);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/convolab/episodes/ep-123',
        expect.objectContaining({ credentials: 'include' })
      );
    });

    it('should add cache-busting param when bustCache is true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'ep-123' }),
      });

      const { result } = renderHook(() => useEpisodes());

      await act(async () => {
        await result.current.getEpisode('ep-123', true);
      });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('_t=');
    });
  });

  describe('deleteEpisode', () => {
    it('should delete episode by id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const { result } = renderHook(() => useEpisodes());

      await act(async () => {
        await result.current.deleteEpisode('ep-123');
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/convolab/episodes/ep-123',
        expect.objectContaining({
          method: 'DELETE',
          credentials: 'include',
        })
      );
    });
  });
});
