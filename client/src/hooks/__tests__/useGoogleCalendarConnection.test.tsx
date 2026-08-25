import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestQueryClient, createWrapper } from '../../__tests__/hooks/test-utils';
import {
  GoogleCalendarRequestError,
  GOOGLE_CALENDAR_SYNC_POLL_TIMEOUT_MS,
  googleCalendarConnectionKey,
  googleCalendarKeys,
  googleCalendarSyncPollInterval,
  googleCalendarSyncTimeoutRemaining,
  useDisconnectGoogleCalendar,
  useGoogleCalendars,
  useGoogleCalendarConnection,
  usePreviewGoogleCalendarEvents,
  useSaveGoogleCalendarSettings,
  useSyncGoogleCalendar,
} from '../useGoogleCalendarConnection';
import { studyActivityKeys } from '../useStudyActivity';
import { googleCalendarCompatibilityFixture } from '../../test/fixtures/learningOsCompatibility';

const { fetchWithCsrfMock, notifyAuthSessionExpiredMock } = vi.hoisted(() => ({
  fetchWithCsrfMock: vi.fn(),
  notifyAuthSessionExpiredMock: vi.fn(),
}));

vi.mock('../../lib/csrf', () => ({ fetchWithCsrf: fetchWithCsrfMock }));
vi.mock('../../lib/authSession', () => ({
  notifyAuthSessionExpired: notifyAuthSessionExpiredMock,
}));

const status = {
  connected: true,
  accountEmail: 'andrew@example.com',
  scopes: ['calendar.readonly'],
  settings: null,
  connectedAt: '2026-08-15T14:00:00Z',
  lastSyncedAt: null,
  sync: { status: 'idle', errorCode: null, statusAt: null },
};

describe('Google Calendar connection requests', () => {
  beforeEach(() => {
    fetchWithCsrfMock.mockReset();
    notifyAuthSessionExpiredMock.mockReset();
  });

  it('loads the safe connection status with the browser session', async () => {
    fetchWithCsrfMock.mockResolvedValue(
      new Response(JSON.stringify(status), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { result } = renderHook(() => useGoogleCalendarConnection(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toEqual(status));
    expect(fetchWithCsrfMock).toHaveBeenCalledWith(
      '/api/study/google-calendar',
      expect.objectContaining({ credentials: 'include' })
    );
    expect(notifyAuthSessionExpiredMock).toHaveBeenCalledOnce();
  });

  it('loads the canonical provider connection shape including sync diagnostics', async () => {
    const providerStatus = googleCalendarCompatibilityFixture.cases[1].payload;
    fetchWithCsrfMock.mockResolvedValue(
      new Response(JSON.stringify(providerStatus), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { result } = renderHook(() => useGoogleCalendarConnection(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.data).toEqual(providerStatus));

    expect(result.current.data?.nextLesson?.title).toBe('iTalki with Yuki');
    expect(result.current.data?.sync).toMatchObject({
      status: 'failed',
      errorCode: 'provider_unavailable',
    });
  });

  it('polls only while a calendar sync is queued or running', () => {
    expect(googleCalendarSyncPollInterval('queued')).toBe(2000);
    expect(googleCalendarSyncPollInterval('running')).toBe(2000);
    expect(googleCalendarSyncPollInterval('idle')).toBe(false);
    expect(googleCalendarSyncPollInterval('succeeded')).toBe(false);
    expect(googleCalendarSyncPollInterval('failed')).toBe(false);
    expect(googleCalendarSyncPollInterval(undefined)).toBe(false);
    expect(googleCalendarSyncPollInterval('running', true)).toBe(false);
    expect(
      googleCalendarSyncTimeoutRemaining('2026-08-16T12:00:00Z', Date.parse('2026-08-16T12:05:00Z'))
    ).toBe(0);
    expect(googleCalendarSyncTimeoutRemaining(null, Date.now())).toBe(
      GOOGLE_CALENDAR_SYNC_POLL_TIMEOUT_MS
    );
  });

  it('performs a final timeout refetch and surfaces a terminal sync status', async () => {
    const running = {
      ...status,
      sync: { status: 'running' as const, errorCode: null, statusAt: '2026-08-16T12:00:00Z' },
    };
    const failed = {
      ...status,
      sync: {
        status: 'failed' as const,
        errorCode: 'invalid_provider_response',
        statusAt: '2026-08-16T12:05:01Z',
      },
    };
    fetchWithCsrfMock
      .mockResolvedValueOnce(new Response(JSON.stringify(running), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(failed), { status: 200 }));

    const { result } = renderHook(() => useGoogleCalendarConnection(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data?.sync?.status).toBe('failed'));
    expect(result.current.syncPollingTimedOut).toBe(false);
    expect(fetchWithCsrfMock).toHaveBeenCalledTimes(2);
  });

  it('offers recovery when the final timeout refetch is still active', async () => {
    const running = {
      ...status,
      sync: { status: 'running' as const, errorCode: null, statusAt: '2026-08-16T12:00:00Z' },
    };
    fetchWithCsrfMock.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(running), { status: 200 }))
    );

    const { result } = renderHook(() => useGoogleCalendarConnection(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.syncPollingTimedOut).toBe(true));
    expect(result.current.data?.sync?.status).toBe('running');
    expect(fetchWithCsrfMock).toHaveBeenCalledTimes(2);
  });

  it('posts a bodyless sync and caches the returned full connection status', async () => {
    const queued = {
      ...status,
      sync: { status: 'queued' as const, errorCode: null, statusAt: '2026-08-16T12:00:00Z' },
    };
    const queryClient = createTestQueryClient();
    const setQueryData = vi.spyOn(queryClient, 'setQueryData');
    fetchWithCsrfMock.mockResolvedValue(new Response(JSON.stringify(queued), { status: 202 }));
    const { result } = renderHook(() => useSyncGoogleCalendar(), {
      wrapper: createWrapper(queryClient),
    });
    result.current.mutate();
    await waitFor(() => expect(result.current.data).toEqual(queued));
    const [url, init] = fetchWithCsrfMock.mock.calls[0];
    expect(url).toBe('/api/study/google-calendar/sync');
    expect(init).toEqual(expect.objectContaining({ method: 'POST', credentials: 'include' }));
    expect(init.body).toBeUndefined();
    expect(init.headers.get('Content-Type')).toBeNull();
    expect(setQueryData).toHaveBeenCalledWith(googleCalendarConnectionKey, queued);
  });

  it('refetches connection state after a sync request error', async () => {
    const succeeded = {
      ...status,
      sync: { status: 'succeeded' as const, errorCode: null, statusAt: '2026-08-16T12:01:00Z' },
    };
    fetchWithCsrfMock
      .mockResolvedValueOnce(new Response(JSON.stringify(status), { status: 200 }))
      .mockRejectedValueOnce(new Error('request timed out'))
      .mockResolvedValueOnce(new Response(JSON.stringify(succeeded), { status: 200 }));
    const { result } = renderHook(
      () => ({ connection: useGoogleCalendarConnection(), sync: useSyncGoogleCalendar() }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => expect(result.current.connection.data).toEqual(status));
    result.current.sync.mutate();

    await waitFor(() => expect(result.current.sync.isError).toBe(true));
    expect(result.current.connection.data).toEqual(succeeded);
    expect(fetchWithCsrfMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/study/google-calendar',
      '/api/study/google-calendar/sync',
      '/api/study/google-calendar',
    ]);
  });

  it('invalidates all study time once after completion across an unmount', async () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const queued = {
      ...status,
      sync: { status: 'queued' as const, errorCode: null, statusAt: '2026-08-16T12:00:00Z' },
    };
    const succeeded = {
      ...status,
      lastSyncedAt: '2026-08-16T12:01:00Z',
      sync: {
        status: 'succeeded' as const,
        errorCode: null,
        statusAt: '2026-08-16T12:01:00Z',
      },
    };
    queryClient.setQueryData(googleCalendarConnectionKey, queued);
    fetchWithCsrfMock.mockReturnValue(new Promise(() => {}));
    const wrapper = createWrapper(queryClient);
    const { unmount } = renderHook(() => useGoogleCalendarConnection(), { wrapper });
    unmount();

    await act(async () => {
      queryClient.setQueryData(googleCalendarConnectionKey, succeeded);
    });
    renderHook(() => useGoogleCalendarConnection(), { wrapper });
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: studyActivityKeys.all })
    );
    await act(async () => {
      queryClient.setQueryData(googleCalendarConnectionKey, { ...succeeded });
    });

    expect(
      invalidate.mock.calls.filter(
        ([options]) => JSON.stringify(options?.queryKey) === JSON.stringify(studyActivityKeys.all)
      )
    ).toHaveLength(1);
  });

  it('clears a failed run marker before tracking a later run', async () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = createWrapper(queryClient);
    queryClient.setQueryData(googleCalendarConnectionKey, {
      ...status,
      sync: { status: 'queued', errorCode: null, statusAt: '2026-08-16T12:00:00Z' },
    });
    fetchWithCsrfMock.mockReturnValue(new Promise(() => {}));
    const view = renderHook(() => useGoogleCalendarConnection(), { wrapper });

    await act(async () => {
      queryClient.setQueryData(googleCalendarConnectionKey, {
        ...status,
        sync: { status: 'failed', errorCode: null, statusAt: '2026-08-16T12:01:00Z' },
      });
    });
    await waitFor(() => expect(view.result.current.data?.sync?.status).toBe('failed'));
    await act(async () => {
      queryClient.setQueryData(googleCalendarConnectionKey, {
        ...status,
        sync: { status: 'succeeded', errorCode: null, statusAt: '2026-08-16T12:02:00Z' },
      });
    });
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: studyActivityKeys.all });

    await act(async () => {
      queryClient.setQueryData(googleCalendarConnectionKey, {
        ...status,
        sync: { status: 'running', errorCode: null, statusAt: '2026-08-16T12:03:00Z' },
      });
    });
    await waitFor(() => expect(view.result.current.data?.sync?.status).toBe('running'));
    await act(async () => {
      queryClient.setQueryData(googleCalendarConnectionKey, {
        ...status,
        sync: { status: 'succeeded', errorCode: null, statusAt: '2026-08-16T12:04:00Z' },
      });
    });
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: studyActivityKeys.all })
    );
  });

  it('loads the exact calendar-list contract', async () => {
    const calendars = {
      calendars: [{ id: 'primary', name: 'Andrew', primary: true }],
      truncated: false,
    };
    fetchWithCsrfMock.mockResolvedValue(new Response(JSON.stringify(calendars), { status: 200 }));
    const { result } = renderHook(() => useGoogleCalendars(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.data).toEqual(calendars));
    expect(fetchWithCsrfMock).toHaveBeenCalledWith(
      '/api/study/google-calendar/calendars',
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('saves canonical settings and deterministically refreshes calendar data', async () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    queryClient.setQueryData(googleCalendarConnectionKey, status);
    const settings = {
      calendarIds: ['primary'],
      titleMatchTerms: ['iTalki'],
      syncEnabled: true,
    };
    const savedStatus = { ...status, settings };
    fetchWithCsrfMock
      .mockResolvedValueOnce(new Response(JSON.stringify(status), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(settings), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(savedStatus), { status: 200 }));
    const { result } = renderHook(
      () => ({ connection: useGoogleCalendarConnection(), save: useSaveGoogleCalendarSettings() }),
      {
        wrapper: createWrapper(queryClient),
      }
    );
    await waitFor(() => expect(result.current.connection.data).toEqual(status));

    result.current.save.mutate({
      calendarIds: [' primary ', 'primary'],
      titleMatchTerms: [' iTalki ', 'ITALKI'],
      syncEnabled: true,
    });
    await waitFor(() => expect(result.current.save.isSuccess).toBe(true));

    const [, init] = fetchWithCsrfMock.mock.calls[1];
    expect(fetchWithCsrfMock).toHaveBeenCalledWith(
      '/api/study/google-calendar/settings',
      expect.objectContaining({ method: 'PUT', credentials: 'include' })
    );
    expect(init.body).toBe(JSON.stringify(settings));
    expect(init.headers.get('Accept')).toBe('application/json');
    expect(init.headers.get('Content-Type')).toBe('application/json');
    expect(queryClient.getQueryData(googleCalendarConnectionKey)).toEqual(savedStatus);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: googleCalendarConnectionKey });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: googleCalendarKeys.calendars() });
  });

  it('posts the exact canonical unsaved preview contract without saving settings', async () => {
    const preview = {
      generatedAt: '2026-08-15T12:00:00Z',
      startsAt: '2026-07-15T12:00:00Z',
      endsAt: '2026-08-15T12:00:00Z',
      scannedEventCount: 8,
      matchedEventCount: 1,
      truncated: false,
      matches: [
        {
          calendarId: 'primary',
          calendarName: 'Andrew',
          title: 'iTalki lesson',
          startsAt: '2026-08-14T10:00:00Z',
          endsAt: '2026-08-14T11:00:00Z',
          durationMs: 3_600_000,
          matchedTerms: ['iTalki'],
          alreadySynced: false,
        },
      ],
    };
    fetchWithCsrfMock.mockResolvedValue(new Response(JSON.stringify(preview), { status: 200 }));
    const { result } = renderHook(() => usePreviewGoogleCalendarEvents(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      calendarIds: [' primary ', 'primary'],
      titleMatchTerms: [' iTalki ', 'ITALKI'],
    });
    await waitFor(() => expect(result.current.data).toEqual(preview));

    const [url, init] = fetchWithCsrfMock.mock.calls[0];
    expect(url).toBe('/api/study/google-calendar/preview');
    expect(init).toEqual(expect.objectContaining({ method: 'POST', credentials: 'include' }));
    expect(JSON.parse(init.body)).toEqual({
      calendarIds: ['primary'],
      titleMatchTerms: ['iTalki'],
    });
    expect(Object.keys(JSON.parse(init.body))).toEqual(['calendarIds', 'titleMatchTerms']);
    expect(init.headers.get('Accept')).toBe('application/json');
    expect(init.headers.get('Content-Type')).toBe('application/json');
  });

  it('rejects an invalid preview before querying Google Calendar', async () => {
    const { result } = renderHook(() => usePreviewGoogleCalendarEvents(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ calendarIds: [], titleMatchTerms: [] });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(fetchWithCsrfMock).not.toHaveBeenCalled();
    expect(result.current.error).toMatchObject({ kind: 'validation', status: null });
  });

  it('rejects an invalid draft before making a request', async () => {
    const { result } = renderHook(() => useSaveGoogleCalendarSettings(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ calendarIds: [], titleMatchTerms: [], syncEnabled: true });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(fetchWithCsrfMock).not.toHaveBeenCalled();
    expect(result.current.error).toMatchObject({ kind: 'validation', status: null });
  });

  it.each([
    [409, 'not_connected'],
    [422, 'validation'],
    [429, 'rate_limited'],
    [502, 'unavailable'],
    [503, 'unavailable'],
  ] as const)('maps HTTP %i to a safe %s error', async (statusCode, kind) => {
    fetchWithCsrfMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'private provider detail' }), { status: statusCode })
    );
    const { result } = renderHook(() => useGoogleCalendars(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(GoogleCalendarRequestError);
    expect(result.current.error).toMatchObject({ kind, status: statusCode });
    expect(result.current.error?.message).not.toContain('private provider detail');
    expect(notifyAuthSessionExpiredMock).toHaveBeenCalledOnce();
  });

  it('maps only allowlisted 422 fields without retaining private server messages', async () => {
    const privateDetail = 'private provider validation detail';
    fetchWithCsrfMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          message: privateDetail,
          errors: {
            calendarIds: [privateDetail],
            'calendarIds.2': [privateDetail],
            'titleMatchTerms.0': [privateDetail],
            syncEnabled: [privateDetail],
            'syncEnabled.value': [privateDetail],
            providerAccount: [privateDetail],
          },
        }),
        { status: 422 }
      )
    );
    const { result } = renderHook(() => useGoogleCalendars(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(GoogleCalendarRequestError);
    const error = result.current.error as GoogleCalendarRequestError;
    expect(error.validationErrors).toEqual([
      { field: 'calendarIds', code: 'server_rejected' },
      { field: 'titleMatchTerms', code: 'server_rejected' },
      { field: 'syncEnabled', code: 'server_rejected' },
    ]);
    expect(error.message).not.toContain(privateDetail);
    expect(JSON.stringify(error)).not.toContain(privateDetail);
  });

  it.each([
    ['malformed JSON', '{not-json'],
    ['an invalid errors collection', JSON.stringify({ errors: ['private detail'] })],
  ])('ignores %s in a 422 response', async (_description, body) => {
    fetchWithCsrfMock.mockResolvedValue(new Response(body, { status: 422 }));
    const { result } = renderHook(() => useGoogleCalendars(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toMatchObject({
      kind: 'validation',
      validationErrors: [],
    });
  });

  it('uses an operation-neutral fallback for an unmapped read failure', async () => {
    fetchWithCsrfMock.mockResolvedValue(new Response(null, { status: 500 }));
    const { result } = renderHook(() => useGoogleCalendars(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toMatchObject({
      kind: 'request_failed',
      status: 500,
      message: "Couldn't communicate with Google Calendar. Please try again.",
    });
  });

  it('disconnects through the CSRF-aware delete contract', async () => {
    const queryClient = createTestQueryClient();
    const remove = vi.spyOn(queryClient, 'removeQueries');
    const disconnectedStatus = {
      connected: false,
      accountEmail: null,
      scopes: [],
      settings: null,
      connectedAt: null,
      lastSyncedAt: null,
      sync: null,
    };
    queryClient.setQueryData(googleCalendarKeys.calendars(), { calendars: [], truncated: false });
    fetchWithCsrfMock
      .mockResolvedValueOnce(new Response(JSON.stringify(status), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(disconnectedStatus), { status: 200 }));
    const { result } = renderHook(
      () => ({
        connection: useGoogleCalendarConnection(),
        disconnect: useDisconnectGoogleCalendar(),
      }),
      { wrapper: createWrapper(queryClient) }
    );
    await waitFor(() => expect(result.current.connection.data).toEqual(status));

    result.current.disconnect.mutate();

    await waitFor(() => expect(result.current.disconnect.isSuccess).toBe(true));
    expect(fetchWithCsrfMock).toHaveBeenCalledWith(
      '/api/study/google-calendar',
      expect.objectContaining({ method: 'DELETE', credentials: 'include' })
    );
    expect(remove).toHaveBeenCalledWith({ queryKey: googleCalendarKeys.all });
    expect(queryClient.getQueryData(googleCalendarConnectionKey)).toEqual(disconnectedStatus);
    expect(queryClient.getQueryData(googleCalendarKeys.calendars())).toBeUndefined();
  });
});
