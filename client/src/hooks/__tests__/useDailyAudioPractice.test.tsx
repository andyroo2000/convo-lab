import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CSRF_TOKEN_COOKIE_NAME, CSRF_TOKEN_HEADER_NAME } from '../../lib/csrf';
import { AUTH_SESSION_EXPIRED_EVENT } from '../../lib/authSession';
import {
  dailyAudioPracticeKeys,
  useCreateDailyAudioPractice,
  useDailyAudioPractice,
  useDailyAudioPracticeStatus,
  useRecentDailyAudioPractice,
} from '../useDailyAudioPractice';

vi.mock('../../config', () => ({
  API_URL: 'http://localhost:3001',
  SHOW_ONBOARDING_WELCOME: false,
}));

const practiceId = '123e4567-e89b-42d3-a456-426614174100';
const practice = {
  id: practiceId,
  userId: 'user-1',
  practiceDate: '2026-07-18',
  status: 'ready' as const,
  targetDurationMinutes: 30,
  targetLanguage: 'ja' as const,
  nativeLanguage: 'en' as const,
  sourceCardIdsJson: [],
  selectionSummaryJson: null,
  errorMessage: null,
  createdAt: '2026-07-18T12:00:00.000Z',
  updatedAt: '2026-07-18T12:00:00.000Z',
  tracks: [
    {
      id: '123e4567-e89b-42d3-a456-426614174102',
      practiceId,
      mode: 'story' as const,
      status: 'skipped' as const,
      title: 'Story',
      sortOrder: 2,
      createdAt: '2026-07-18T12:00:00.000Z',
      updatedAt: '2026-07-18T12:00:00.000Z',
    },
    {
      id: '123e4567-e89b-42d3-a456-426614174101',
      practiceId,
      mode: 'drill' as const,
      status: 'ready' as const,
      title: 'Drill',
      sortOrder: 1,
      createdAt: '2026-07-18T12:00:00.000Z',
      updatedAt: '2026-07-18T12:00:00.000Z',
    },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function createWrapper(
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
) {
  const Wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return Wrapper;
}

describe('Daily Audio API requests', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=test-csrf-token; path=/`;
  });

  afterEach(() => {
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    vi.unstubAllGlobals();
  });

  it('loads sorted list reads through Learning OS', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([practice]));

    const { result } = renderHook(() => useRecentDailyAudioPractice(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/daily-audio-practice',
      expect.objectContaining({ credentials: 'include' })
    );
    expect(result.current.data?.[0]?.tracks.map((track) => track.sortOrder)).toEqual([1, 2]);
  });

  it('routes detail and status reads through Learning OS with encoded IDs', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(practice)).mockResolvedValueOnce(
      jsonResponse({
        id: practiceId,
        status: 'ready',
        progress: 100,
        tracks: [],
      })
    );

    const { result: detailResult } = renderHook(() => useDailyAudioPractice(practiceId), {
      wrapper: createWrapper(),
    });
    const { result: statusResult } = renderHook(
      () => useDailyAudioPracticeStatus(practiceId, true),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => expect(detailResult.current.isSuccess).toBe(true));
    await waitFor(() => expect(statusResult.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith(
      `/api/daily-audio-practice/${practiceId}`,
      expect.any(Object)
    );
    expect(mockFetch).toHaveBeenCalledWith(
      `/api/daily-audio-practice/${practiceId}/status`,
      expect.any(Object)
    );
  });

  it('routes generation POSTs through Learning OS', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse(practice));

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const { result } = renderHook(() => useCreateDailyAudioPractice(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/daily-audio-practice',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      })
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      '/sanctum/csrf-cookie',
      expect.objectContaining({ credentials: 'include' })
    );
    const mutationHeaders = new Headers(mockFetch.mock.calls[1]?.[1]?.headers);
    expect(mutationHeaders.get(CSRF_TOKEN_HEADER_NAME)).toBe('test-csrf-token');
    expect(queryClient.getQueryData(dailyAudioPracticeKeys.detail(practiceId))).toEqual({
      ...practice,
      tracks: [...practice.tracks].sort((left, right) => left.sortOrder - right.sortOrder),
    });
  });

  it('notifies the app when a Daily Audio read finds an expired Convo Lab session', async () => {
    const onSessionExpired = vi.fn();
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, onSessionExpired);
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Authentication required' }, 401));

    const { result } = renderHook(() => useRecentDailyAudioPractice(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(onSessionExpired).toHaveBeenCalledOnce();

    window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, onSessionExpired);
  });
});
