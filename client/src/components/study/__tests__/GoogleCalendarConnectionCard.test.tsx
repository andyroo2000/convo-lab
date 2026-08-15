import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import GoogleCalendarConnectionCard from '../GoogleCalendarConnectionCard';

const { connectionMock, disconnectMock, mutateMock, refetchMock, resetMock } = vi.hoisted(() => ({
  connectionMock: vi.fn(),
  disconnectMock: vi.fn(),
  mutateMock: vi.fn(),
  refetchMock: vi.fn(),
  resetMock: vi.fn(),
}));

vi.mock('../../../hooks/useGoogleCalendarConnection', () => ({
  googleCalendarConnectPath: '/api/study/google-calendar/connect',
  useGoogleCalendarConnection: () => connectionMock(),
  useDisconnectGoogleCalendar: () => disconnectMock(),
}));

const disconnected = {
  connected: false,
  accountEmail: null,
  scopes: [],
  settings: null,
  connectedAt: null,
  lastSyncedAt: null,
};

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location-search">{location.search}</output>;
};

function renderCard(initialEntry = '/app/study/time') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <GoogleCalendarConnectionCard />
      <LocationProbe />
    </MemoryRouter>
  );
}

describe('GoogleCalendarConnectionCard', () => {
  beforeEach(() => {
    refetchMock.mockReset().mockResolvedValue(undefined);
    mutateMock.mockReset();
    resetMock.mockReset();
    connectionMock.mockReset().mockReturnValue({
      data: disconnected,
      isLoading: false,
      isError: false,
      refetch: refetchMock,
    });
    disconnectMock.mockReset().mockReturnValue({
      mutate: mutateMock,
      reset: resetMock,
      isPending: false,
      isError: false,
    });
  });

  it('uses a session-bound browser navigation to connect', () => {
    renderCard();

    expect(screen.getByRole('link', { name: 'Connect Google Calendar' })).toHaveAttribute(
      'href',
      '/api/study/google-calendar/connect'
    );
    expect(screen.getByText(/read-only calendar access/i)).toBeInTheDocument();
  });

  it('shows safe account, scope, and sync details for a connected calendar', () => {
    connectionMock.mockReturnValue({
      data: {
        ...disconnected,
        connected: true,
        accountEmail: 'andrew@example.com',
        scopes: [
          'https://www.googleapis.com/auth/calendar.readonly',
          '<script>not-a-scope</script>',
        ],
        connectedAt: '2026-08-15T14:00:00Z',
        lastSyncedAt: '2026-08-15T14:11:12Z',
      },
      isLoading: false,
      isError: false,
      refetch: refetchMock,
    });

    renderCard();

    expect(screen.getByText('andrew@example.com')).toBeInTheDocument();
    expect(
      screen.getByText('View calendar events, Additional calendar access')
    ).toBeInTheDocument();
    expect(screen.queryByText('<script>not-a-scope</script>')).not.toBeInTheDocument();
    expect(screen.queryByText('Waiting for the first sync')).not.toBeInTheDocument();
  });

  it('uses the unsynced fallback for a malformed sync timestamp', () => {
    connectionMock.mockReturnValue({
      data: { ...disconnected, connected: true, lastSyncedAt: 'not-a-date' },
      isLoading: false,
      isError: false,
      refetch: refetchMock,
    });

    renderCard();

    expect(screen.getByText('Waiting for the first sync')).toBeInTheDocument();
    expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument();
  });

  it('confirms before disconnecting', () => {
    connectionMock.mockReturnValue({
      data: { ...disconnected, connected: true, accountEmail: 'andrew@example.com' },
      isLoading: false,
      isError: false,
      refetch: refetchMock,
    });
    renderCard();

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(mutateMock).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('modal-button-confirm'));

    expect(mutateMock).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  it('shows a failed disconnect inside the open confirmation dialog', () => {
    connectionMock.mockReturnValue({
      data: { ...disconnected, connected: true, accountEmail: 'andrew@example.com' },
      isLoading: false,
      isError: false,
      refetch: refetchMock,
    });
    disconnectMock.mockReturnValue({
      mutate: mutateMock,
      reset: resetMock,
      isPending: false,
      isError: true,
    });
    renderCard();

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

    expect(screen.getByRole('dialog')).toContainElement(screen.getByRole('alert'));
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn’t disconnect/i);
  });

  it('clears a stale disconnect error when the dialog is closed', () => {
    connectionMock.mockReturnValue({
      data: { ...disconnected, connected: true },
      isLoading: false,
      isError: false,
      refetch: refetchMock,
    });
    renderCard();

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    fireEvent.click(screen.getByTestId('modal-button-cancel'));

    expect(resetMock).toHaveBeenCalledOnce();
  });

  it('refreshes status, keeps a friendly callback result, and cleans callback parameters', async () => {
    renderCard('/app/study/time?calendarConnection=error&reason=access_denied&keep=1');

    expect(screen.getByRole('alert')).toHaveTextContent(/access was canceled/i);
    await waitFor(() => expect(refetchMock).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent('?keep=1'));
    expect(screen.getByRole('alert')).not.toHaveTextContent('access_denied');
  });

  it('offers a retry when status loading fails', () => {
    connectionMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: refetchMock,
    });
    renderCard();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetchMock).toHaveBeenCalledOnce();
  });

  it('does not show stale connection data alongside a status error', () => {
    connectionMock.mockReturnValue({
      data: { ...disconnected, connected: true, accountEmail: 'stale@example.com' },
      isLoading: false,
      isError: true,
      refetch: refetchMock,
    });
    renderCard();

    expect(screen.getByRole('alert')).toHaveTextContent(/couldn’t check/i);
    expect(screen.queryByText('stale@example.com')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Disconnect' })).not.toBeInTheDocument();
  });

  it('shows a successful callback result after cleaning its query parameter', async () => {
    renderCard('/app/study/time?calendarConnection=connected');

    expect(screen.getByText(/is connected\. Your study timeline/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('location-search')).toBeEmptyDOMElement());
  });
});
