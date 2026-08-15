import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestQueryClient, createWrapper } from '../../__tests__/hooks/test-utils';
import {
  GoogleCalendarRequestError,
  googleCalendarConnectionKey,
  googleCalendarKeys,
  useDisconnectGoogleCalendar,
  useGoogleCalendars,
  useGoogleCalendarConnection,
  useSaveGoogleCalendarSettings,
} from '../useGoogleCalendarConnection';

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
