import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createWrapper } from '../../__tests__/hooks/test-utils';
import {
  useDisconnectGoogleCalendar,
  useGoogleCalendarConnection,
} from '../useGoogleCalendarConnection';

const { fetchWithCsrfMock } = vi.hoisted(() => ({ fetchWithCsrfMock: vi.fn() }));

vi.mock('../../lib/csrf', () => ({ fetchWithCsrf: fetchWithCsrfMock }));

const status = {
  connected: true,
  accountEmail: 'andrew@example.com',
  scopes: ['calendar.readonly'],
  settings: {},
  connectedAt: '2026-08-15T14:00:00Z',
  lastSyncedAt: null,
};

describe('Google Calendar connection requests', () => {
  beforeEach(() => fetchWithCsrfMock.mockReset());

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
  });

  it('disconnects through the CSRF-aware delete contract', async () => {
    fetchWithCsrfMock.mockResolvedValue(new Response(null, { status: 204 }));
    const { result } = renderHook(() => useDisconnectGoogleCalendar(), {
      wrapper: createWrapper(),
    });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchWithCsrfMock).toHaveBeenCalledWith(
      '/api/study/google-calendar',
      expect.objectContaining({ method: 'DELETE', credentials: 'include' })
    );
  });
});
