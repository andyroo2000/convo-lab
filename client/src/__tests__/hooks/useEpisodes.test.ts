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

function mockSuccessfulJob(jobId: string) {
  mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ jobId }) });
  return renderHook(() => useEpisodes());
}

async function expectGenerationFailure(operation: () => Promise<string>, message: string) {
  await act(async () => {
    await expect(operation()).rejects.toThrow(message);
  });
}

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

      expect(typeof result.current.generateAudio).toBe('function');
      expect(typeof result.current.generateAllSpeedsAudio).toBe('function');
      expect(typeof result.current.getEpisode).toBe('function');
      expect(typeof result.current.deleteEpisode).toBe('function');
    });
  });

  it.each([
    ['generateAudio', '/api/convolab/audio/generate'],
    ['generateAllSpeedsAudio', '/api/convolab/audio/generate-all-speeds'],
  ] as const)('%s submits to its audio endpoint', async (method, endpoint) => {
    const { result } = mockSuccessfulJob('audio-job-123');
    let jobId: string | null = null;
    await act(async () => {
      jobId = await result.current[method]('ep-123', 'd-456');
    });
    expect(jobId).toBe('audio-job-123');
    expect(mockFetch).toHaveBeenCalledWith(endpoint, expect.objectContaining({ method: 'POST' }));
  });

  describe('generateAudio', () => {
    it('should use default speed and pauseMode', async () => {
      const { result } = mockSuccessfulJob('job-123');

      await act(async () => {
        await result.current.generateAudio('ep-123', 'd-456');
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.speed).toBe('medium');
      expect(callBody.pauseMode).toBe(false);
    });

    it('should surface Learning OS error messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Audio generation is unavailable' }),
      });

      const { result } = renderHook(() => useEpisodes());

      await expectGenerationFailure(
        () => result.current.generateAudio('ep-123', 'd-456'),
        'Audio generation is unavailable'
      );

      expect(result.current.error).toBe('Audio generation is unavailable');
    });
  });

  describe('generateAllSpeedsAudio', () => {
    it('should retain the fallback when Learning OS returns a non-JSON error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      });

      const { result } = renderHook(() => useEpisodes());

      await expectGenerationFailure(
        () => result.current.generateAllSpeedsAudio('ep-123', 'd-456'),
        'Failed to generate multi-speed audio'
      );

      expect(result.current.error).toBe('Failed to generate multi-speed audio');
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
