import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEpisodes } from '../../hooks/useEpisodes';

// Mock the config
vi.mock('../../config', () => ({
  API_URL: 'http://localhost:3001',
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
        'http://localhost:3001/api/episodes',
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
        response = await result.current.generateDialogue('ep-123', speakers, 3, 6);
      });

      expect(response.jobId).toBe('job-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/dialogue/generate',
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
        await result.current.generateDialogue('ep-123', []);
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.variationCount).toBe(3);
      expect(callBody.dialogueLength).toBe(6);
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
        'http://localhost:3001/api/audio/generate',
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
        'http://localhost:3001/api/audio/generate-all-speeds',
        expect.objectContaining({
          method: 'POST',
        })
      );
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
        'http://localhost:3001/api/episodes/ep-123',
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
        'http://localhost:3001/api/episodes/ep-123',
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

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/audio/job/job-123',
        expect.any(Object)
      );
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

  describe('Error Metadata (Quota)', () => {
    it('should initialize with null errorMetadata', () => {
      const { result } = renderHook(() => useEpisodes());

      expect(result.current.errorMetadata).toBeNull();
    });

    it('should capture quota metadata from 429 response in generateDialogue', async () => {
      const quotaError = {
        error: 'Quota exceeded',
        quota: {
          used: 5,
          limit: 5,
          resetsAt: '2026-02-01T00:00:00.000Z',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve(quotaError),
      });

      const { result } = renderHook(() => useEpisodes());

      await act(async () => {
        try {
          await result.current.generateDialogue('ep-123', []);
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.errorMetadata).toEqual({
        message: 'Quota exceeded',
        status: 429,
        quota: {
          used: 5,
          limit: 5,
          resetsAt: '2026-02-01T00:00:00.000Z',
        },
      });
    });

    it('should set errorMetadata without quota when quota not in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      const { result } = renderHook(() => useEpisodes());

      await act(async () => {
        try {
          await result.current.generateDialogue('ep-123', []);
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.errorMetadata).toEqual({
        message: 'Server error',
        status: 500,
      });
      expect(result.current.errorMetadata?.quota).toBeUndefined();
    });

    it('should use message field when error field not present', async () => {
      const errorResponse = {
        message: 'Custom error message',
        quota: {
          used: 3,
          limit: 5,
          resetsAt: '2026-02-01T00:00:00.000Z',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve(errorResponse),
      });

      const { result } = renderHook(() => useEpisodes());

      await act(async () => {
        try {
          await result.current.generateDialogue('ep-123', []);
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.errorMetadata?.message).toBe('Custom error message');
      expect(result.current.errorMetadata?.quota).toEqual(errorResponse.quota);
    });

    it('should use default error message when neither error nor message present', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({}),
      });

      const { result } = renderHook(() => useEpisodes());

      await act(async () => {
        try {
          await result.current.generateDialogue('ep-123', []);
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.errorMetadata?.message).toBe('Failed to generate dialogue');
    });

    it('should clear previous errorMetadata on successful request', async () => {
      // First request fails with quota error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () =>
          Promise.resolve({
            error: 'Quota exceeded',
            quota: { used: 5, limit: 5, resetsAt: '2026-02-01T00:00:00.000Z' },
          }),
      });

      const { result } = renderHook(() => useEpisodes());

      await act(async () => {
        try {
          await result.current.generateDialogue('ep-123', []);
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.errorMetadata).not.toBeNull();

      // Second request succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobId: 'job-123' }),
      });

      await act(async () => {
        await result.current.generateDialogue('ep-123', []);
      });

      expect(result.current.errorMetadata).toBeNull();
    });
  });
});
