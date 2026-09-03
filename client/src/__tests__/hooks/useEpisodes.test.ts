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

      expect(typeof result.current.createEpisode).toBe('function');
      expect(typeof result.current.generateDialogue).toBe('function');
      expect(typeof result.current.generateAudio).toBe('function');
      expect(typeof result.current.generateAllSpeedsAudio).toBe('function');
      expect(typeof result.current.getEpisode).toBe('function');
      expect(typeof result.current.deleteEpisode).toBe('function');
      expect(typeof result.current.pollJobStatus).toBe('function');
    });
  });

  describe('createEpisode', () => {
    it('should create episode and return response', async () => {
      const mockEpisode = {
        id: 'ep-123',
        title: 'Test Episode',
        sourceText: 'Hello world',
        targetLanguage: 'ja',
        nativeLanguage: 'en',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEpisode),
      });

      const { result } = renderHook(() => useEpisodes());

      let episode: typeof mockEpisode | null = null;
      await act(async () => {
        episode = await result.current.createEpisode({
          title: 'Test Episode',
          sourceText: 'Hello world',
          targetLanguage: 'ja',
          nativeLanguage: 'en',
          speakers: [],
        });
      });

      expect(episode).toEqual(mockEpisode);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/convolab/episodes',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        })
      );
    });

    it('should set loading state during request', async () => {
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ ok: true, json: () => ({}) }), 100);
          })
      );

      const { result } = renderHook(() => useEpisodes());

      expect(result.current.loading).toBe(false);

      act(() => {
        result.current.createEpisode({
          title: 'Test',
          sourceText: 'Text',
          targetLanguage: 'ja',
          nativeLanguage: 'en',
          speakers: [],
        });
      });

      expect(result.current.loading).toBe(true);
    });

    it('should handle errors and set error state', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Failed to create episode' }),
      });

      const { result } = renderHook(() => useEpisodes());

      await act(async () => {
        try {
          await result.current.createEpisode({
            title: 'Test',
            sourceText: 'Text',
            targetLanguage: 'ja',
            nativeLanguage: 'en',
            speakers: [],
          });
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.error).toBe('Failed to create episode');
      expect(result.current.loading).toBe(false);
    });
  });

  describe('generateDialogue', () => {
    it('should call dialogue generation API with speakers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobId: 'job-123' }),
      });

      const { result } = renderHook(() => useEpisodes());
      const speakers = [
        {
          id: 'speaker-1',
          name: '田中',
          voiceId: 'ja-voice-1',
          proficiency: 'native' as const,
          tone: 'casual' as const,
        },
      ];

      let response!: { jobId: string };
      await act(async () => {
        response = await result.current.generateDialogue({
          episodeId: 'ep-123',
          speakers,
          variationCount: 3,
          dialogueLength: 6,
        });
      });

      expect(response.jobId).toBe('job-123');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/convolab/dialogue/generate',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('ep-123'),
        })
      );
    });

    it('should use default variationCount and dialogueLength', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobId: 'job-123' }),
      });

      const { result } = renderHook(() => useEpisodes());

      await act(async () => {
        await result.current.generateDialogue({ episodeId: 'ep-123', speakers: [] });
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.variationCount).toBe(3);
      expect(callBody.dialogueLength).toBe(6);
    });

    it('should retain the fallback when Learning OS returns a non-JSON error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      });

      const { result } = renderHook(() => useEpisodes());

      await act(async () => {
        await expect(
          result.current.generateDialogue({ episodeId: 'ep-123', speakers: [] })
        ).rejects.toThrow('Failed to generate dialogue');
      });

      expect(result.current.error).toBe('Failed to generate dialogue');
      expect(result.current.errorMetadata).toEqual({
        message: 'Failed to generate dialogue',
        status: 502,
      });
    });

    it('should preserve cooldown metadata from a failed generation request', async () => {
      const cooldown = { remainingSeconds: 45, retryAfter: '2026-09-03T20:00:00Z' };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ message: 'Please wait', cooldown }),
      });

      const { result } = renderHook(() => useEpisodes());

      await act(async () => {
        await expect(
          result.current.generateDialogue({ episodeId: 'ep-123', speakers: [] })
        ).rejects.toThrow('Please wait');
      });

      expect(result.current.errorMetadata).toEqual({
        message: 'Please wait',
        status: 429,
        cooldown,
      });
    });
  });

  describe('generateAudio', () => {
    it('should call audio generation API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobId: 'audio-job-123' }),
      });

      const { result } = renderHook(() => useEpisodes());

      let jobId: string | null = null;
      await act(async () => {
        jobId = await result.current.generateAudio('ep-123', 'd-456', 'medium', false);
      });

      expect(jobId).toBe('audio-job-123');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/convolab/audio/generate',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should use default speed and pauseMode', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobId: 'job-123' }),
      });

      const { result } = renderHook(() => useEpisodes());

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

      await act(async () => {
        await expect(result.current.generateAudio('ep-123', 'd-456')).rejects.toThrow(
          'Audio generation is unavailable'
        );
      });

      expect(result.current.error).toBe('Audio generation is unavailable');
    });
  });

  describe('generateAllSpeedsAudio', () => {
    it('should call multi-speed audio generation API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobId: 'multi-speed-job-123' }),
      });

      const { result } = renderHook(() => useEpisodes());

      let jobId: string | null = null;
      await act(async () => {
        jobId = await result.current.generateAllSpeedsAudio('ep-123', 'd-456');
      });

      expect(jobId).toBe('multi-speed-job-123');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/convolab/audio/generate-all-speeds',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should retain the fallback when Learning OS returns a non-JSON error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      });

      const { result } = renderHook(() => useEpisodes());

      await act(async () => {
        await expect(result.current.generateAllSpeedsAudio('ep-123', 'd-456')).rejects.toThrow(
          'Failed to generate multi-speed audio'
        );
      });

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

  describe('pollJobStatus', () => {
    it('should poll job status until completed', async () => {
      // First call returns pending, second returns completed
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ state: 'active' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ state: 'completed' }),
        });

      const { result } = renderHook(() => useEpisodes());
      const onStatusChange = vi.fn();

      let status: string | null = null;
      await act(async () => {
        // Use a modified version that doesn't actually wait
        vi.useFakeTimers();
        const promise = result.current.pollJobStatus('job-123', onStatusChange, 'dialogue');

        // Fast-forward through the first delay
        await vi.runAllTimersAsync();

        status = await promise;
        vi.useRealTimers();
      });

      expect(status).toBe('completed');
    });

    it('should support different endpoints', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ state: 'completed' }),
      });

      const { result } = renderHook(() => useEpisodes());

      await act(async () => {
        await result.current.pollJobStatus('job-123', undefined, 'audio');
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/convolab/audio/job/job-123', expect.any(Object));
    });

    it('should return failed status on job failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ state: 'failed' }),
      });

      const { result } = renderHook(() => useEpisodes());

      let status: string | null = null;
      await act(async () => {
        status = await result.current.pollJobStatus('job-123');
      });

      expect(status).toBe('failed');
    });

    it('should retry a transient status response', async () => {
      vi.useFakeTimers();
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ state: 'completed' }),
      });

      const { result } = renderHook(() => useEpisodes());
      const poll = result.current.pollJobStatus('job-123');
      await vi.runAllTimersAsync();

      await expect(poll).resolves.toBe('completed');
      expect(mockFetch).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it('aborts the current status request', async () => {
      const controller = new AbortController();
      mockFetch.mockImplementationOnce(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('Polling aborted', 'AbortError'));
            });
          })
      );

      const { result } = renderHook(() => useEpisodes());
      const poll = result.current.pollJobStatus(
        'job-123',
        undefined,
        'dialogue',
        controller.signal
      );

      controller.abort();

      await expect(poll).rejects.toMatchObject({ name: 'AbortError' });
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/convolab/dialogue/job/job-123',
        expect.objectContaining({ signal: controller.signal })
      );
    });

    it('aborts the wait before the next status request', async () => {
      vi.useFakeTimers();
      const controller = new AbortController();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ state: 'active' }),
      });

      const { result } = renderHook(() => useEpisodes());
      const poll = result.current.pollJobStatus(
        'job-123',
        undefined,
        'dialogue',
        controller.signal
      );
      await Promise.resolve();
      await Promise.resolve();

      controller.abort();

      await expect(poll).rejects.toMatchObject({ name: 'AbortError' });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useEpisodes());

      await act(async () => {
        try {
          await result.current.createEpisode({
            title: 'Test',
            sourceText: 'Text',
            targetLanguage: 'ja',
            nativeLanguage: 'en',
            speakers: [],
          });
        } catch {
          // Expected
        }
      });

      expect(result.current.error).toBe('Network error');
    });

    it('should handle unknown errors', async () => {
      mockFetch.mockRejectedValueOnce('Unknown error');

      const { result } = renderHook(() => useEpisodes());

      await act(async () => {
        try {
          await result.current.createEpisode({
            title: 'Test',
            sourceText: 'Text',
            targetLanguage: 'ja',
            nativeLanguage: 'en',
            speakers: [],
          });
        } catch {
          // Expected
        }
      });

      expect(result.current.error).toBe('Unknown error');
    });
  });
});
