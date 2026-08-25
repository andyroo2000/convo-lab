import { act, render, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createWrapper } from '../../__tests__/hooks/test-utils';
import { studyAnalyticsCompatibilityFixture } from '../../test/fixtures/learningOsCompatibility';
import {
  useAutomaticStudyActivity,
  useEditableStudyActivitySessions,
  useStudyActivityAnalytics,
} from '../useStudyActivity';

const { fetchWithCsrfMock, notifyAuthSessionExpiredMock } = vi.hoisted(() => ({
  fetchWithCsrfMock: vi.fn(),
  notifyAuthSessionExpiredMock: vi.fn(),
}));

vi.mock('../../lib/csrf', () => ({ fetchWithCsrf: fetchWithCsrfMock }));
vi.mock('../../lib/authSession', () => ({
  notifyAuthSessionExpired: notifyAuthSessionExpiredMock,
}));

const start = vi.fn();
const stop = vi.fn();

const Harness = ({ enabled = true }: { enabled?: boolean }) => {
  useAutomaticStudyActivity(enabled, start, stop, 5_000);
  return null;
};

describe('useAutomaticStudyActivity', () => {
  let visibility: DocumentVisibilityState;

  beforeEach(() => {
    start.mockReset();
    stop.mockReset();
    vi.useFakeTimers();
    visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('engages while visible and pauses after the idle timeout', () => {
    render(<Harness />);
    expect(start).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(5_000));

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('pauses while hidden and resumes when visible again', () => {
    render(<Harness />);
    visibility = 'hidden';
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(stop).toHaveBeenCalledTimes(1);

    visibility = 'visible';
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(start).toHaveBeenCalledTimes(2);
  });
});

describe('useEditableStudyActivitySessions', () => {
  beforeEach(() => {
    fetchWithCsrfMock.mockReset();
    notifyAuthSessionExpiredMock.mockReset();
  });

  it('loads cursor pages and stops after a null next cursor', async () => {
    const session = (clientSessionId: string) => ({
      id: `server-${clientSessionId}`,
      clientSessionId,
      category: 'immerse',
      activity: 'tv',
      source: 'manual',
      origin: 'web',
      name: 'Drama',
      startedAt: '2026-08-16T14:00:00Z',
      endedAt: '2026-08-16T14:30:00Z',
      durationMs: 1_800_000,
    });
    fetchWithCsrfMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ items: [session('first')], limit: 20, nextCursor: 'next page' }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [session('second')], limit: 20, nextCursor: null }), {
          status: 200,
        })
      );

    const { result } = renderHook(() => useEditableStudyActivitySessions(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));

    await act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));

    expect(fetchWithCsrfMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/study/activity-sessions/editable?per_page=20',
      '/api/study/activity-sessions/editable?per_page=20&cursor=next+page',
    ]);
    expect(result.current.data?.pages.flatMap((page) => page.items)).toEqual([
      expect.objectContaining({ clientSessionId: 'first', editable: true }),
      expect.objectContaining({ clientSessionId: 'second', editable: true }),
    ]);
    expect(result.current.hasNextPage).toBe(false);
    expect(notifyAuthSessionExpiredMock).toHaveBeenCalledTimes(2);
  });
});

describe('useStudyActivityAnalytics', () => {
  beforeEach(() => {
    fetchWithCsrfMock.mockReset();
    notifyAuthSessionExpiredMock.mockReset();
  });

  it('loads and decodes the canonical provider analytics payload', async () => {
    fetchWithCsrfMock.mockResolvedValue(
      new Response(JSON.stringify(studyAnalyticsCompatibilityFixture.cases[0].payload), {
        status: 200,
      })
    );
    const { result } = renderHook(() => useStudyActivityAnalytics('2026-07-28'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.ranges).toHaveLength(5);
    expect(result.current.data?.ranges.find(({ key }) => key === 'week')?.totalMs).toBe(6_601_002);
  });
});
