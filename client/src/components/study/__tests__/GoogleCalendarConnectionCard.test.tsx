import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GoogleCalendarRequestError,
  type GoogleCalendarConnectionStatus,
} from '../../../hooks/useGoogleCalendarConnection';
import GoogleCalendarConnectionCard from '../GoogleCalendarConnectionCard';

const {
  calendarListMock,
  calendarRefetchMock,
  connectionMock,
  disconnectMock,
  mutateMock,
  previewMock,
  previewMutateMock,
  previewResetMock,
  refetchMock,
  resetMock,
  saveMutateMock,
  saveSettingsMock,
  syncMock,
  syncMutateMock,
} = vi.hoisted(() => ({
  calendarListMock: vi.fn(),
  calendarRefetchMock: vi.fn(),
  connectionMock: vi.fn(),
  disconnectMock: vi.fn(),
  mutateMock: vi.fn(),
  previewMock: vi.fn(),
  previewMutateMock: vi.fn(),
  previewResetMock: vi.fn(),
  refetchMock: vi.fn(),
  resetMock: vi.fn(),
  saveMutateMock: vi.fn(),
  saveSettingsMock: vi.fn(),
  syncMock: vi.fn(),
  syncMutateMock: vi.fn(),
}));

vi.mock('../../../hooks/useGoogleCalendarConnection', () => ({
  GoogleCalendarRequestError: class extends Error {
    constructor(
      public kind: string,
      public status: number | null
    ) {
      super(kind);
    }
  },
  googleCalendarConnectPath: '/api/study/google-calendar/connect',
  useGoogleCalendarConnection: () => connectionMock(),
  useDisconnectGoogleCalendar: () => disconnectMock(),
  useGoogleCalendars: () => calendarListMock(),
  usePreviewGoogleCalendarEvents: () => previewMock(),
  useSaveGoogleCalendarSettings: () => saveSettingsMock(),
  useSyncGoogleCalendar: () => syncMock(),
}));

const disconnected = {
  connected: false,
  accountEmail: null,
  scopes: [],
  settings: null,
  connectedAt: null,
  lastSyncedAt: null,
  sync: null,
};

const settings = {
  calendarIds: ['primary'],
  titleMatchTerms: ['iTalki', 'Japanese lesson'],
  syncEnabled: true,
};

const connected = {
  ...disconnected,
  connected: true,
  accountEmail: 'andrew@example.com',
  settings,
  sync: { status: 'idle' as const, errorCode: null, statusAt: null },
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

function showConnected(data: GoogleCalendarConnectionStatus = connected) {
  connectionMock.mockReturnValue({ data, isLoading: false, isError: false, refetch: refetchMock });
}

describe('GoogleCalendarConnectionCard', () => {
  beforeEach(() => {
    refetchMock.mockReset().mockResolvedValue({ data: connected, isSuccess: true });
    mutateMock.mockReset();
    previewMutateMock.mockReset();
    previewResetMock.mockReset();
    resetMock.mockReset();
    calendarRefetchMock.mockReset();
    saveMutateMock.mockReset().mockResolvedValue(settings);
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
    calendarListMock.mockReset().mockReturnValue({
      data: {
        calendars: [
          { id: 'primary', name: 'Andrew', primary: true },
          { id: 'lessons', name: 'Japanese lessons', primary: false },
        ],
        truncated: false,
      },
      isLoading: false,
      isError: false,
      isSuccess: true,
      refetch: calendarRefetchMock,
    });
    saveSettingsMock.mockReset().mockReturnValue({
      mutateAsync: saveMutateMock,
      isPending: false,
      isError: false,
    });
    syncMutateMock.mockReset();
    syncMock.mockReset().mockReturnValue({
      mutate: syncMutateMock,
      isPending: false,
      isError: false,
      error: null,
    });
    previewMock.mockReset().mockReturnValue({
      mutate: previewMutateMock,
      reset: previewResetMock,
      data: undefined,
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

  it('starts a manual sync from a large connected-card action', () => {
    showConnected();
    renderCard();

    const action = screen.getByRole('button', { name: 'Sync now' });
    expect(action).toHaveClass('min-h-11');
    fireEvent.click(action);

    expect(syncMutateMock).toHaveBeenCalledOnce();
  });

  it('shows active sync progress and disables conflicting actions', () => {
    showConnected({
      ...connected,
      sync: { status: 'running', errorCode: null, statusAt: '2026-08-16T12:00:00Z' },
    });
    renderCard();

    expect(screen.getByRole('button', { name: 'Syncing…' })).toHaveClass('gap-2');
    expect(screen.getByRole('button', { name: 'Syncing…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Calendar settings' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeDisabled();
  });

  it('stops a long-running poll and re-enables safe recovery actions', () => {
    connectionMock.mockReturnValue({
      data: {
        ...connected,
        sync: { status: 'running', errorCode: null, statusAt: '2026-08-16T12:00:00Z' },
      },
      isLoading: false,
      isError: false,
      syncPollingTimedOut: true,
      refetch: refetchMock,
    });
    renderCard();

    expect(screen.getByText(/taking longer than expected/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Calendar settings' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(refetchMock).toHaveBeenCalledOnce();
    expect(syncMutateMock).not.toHaveBeenCalled();
  });

  it('announces a completed sync as up to date', () => {
    showConnected({
      ...connected,
      sync: { status: 'succeeded', errorCode: null, statusAt: '2026-08-16T12:00:00Z' },
    });
    renderCard();

    expect(screen.getByText('Calendar study time is up to date.')).toHaveAttribute(
      'role',
      'status'
    );
  });

  it('maps a persisted reconnect failure to the sole recovery action', () => {
    showConnected({
      ...connected,
      sync: {
        status: 'failed',
        errorCode: 'reconnect_required',
        statusAt: '2026-08-16T12:00:00Z',
      },
    });
    renderCard();

    expect(screen.getByRole('alert')).toHaveTextContent(/reconnect Google Calendar/i);
    expect(screen.getByRole('link', { name: 'Reconnect Google Calendar' })).toHaveAttribute(
      'href',
      '/api/study/google-calendar/connect'
    );
    expect(screen.queryByRole('button', { name: 'Try sync again' })).not.toBeInTheDocument();
  });

  it('hides raw manual-sync failure details', () => {
    syncMock.mockReturnValue({
      mutate: syncMutateMock,
      isPending: false,
      isError: true,
      error: new Error('private provider detail'),
    });
    showConnected();
    renderCard();

    expect(screen.getByRole('alert')).toHaveTextContent(/couldn’t sync/i);
    expect(screen.queryByText(/private provider detail/i)).not.toBeInTheDocument();
  });

  it('lets a fresh successful server status supersede a stale request error', () => {
    syncMock.mockReturnValue({
      mutate: syncMutateMock,
      isPending: false,
      isError: true,
      error: new Error('request timed out'),
    });
    showConnected({
      ...connected,
      sync: { status: 'succeeded', errorCode: null, statusAt: '2026-08-16T12:00:00Z' },
    });
    renderCard();

    expect(screen.getByText('Calendar study time is up to date.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('offers reconnection for a not-connected manual-sync response', () => {
    syncMock.mockReturnValue({
      mutate: syncMutateMock,
      isPending: false,
      isError: true,
      error: new GoogleCalendarRequestError('not_connected', 409),
    });
    showConnected();
    renderCard();

    expect(screen.getByRole('link', { name: 'Reconnect Google Calendar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try sync again' })).not.toBeInTheDocument();
    expect(screen.queryByText(/provider detail/i)).not.toBeInTheDocument();
  });

  it('ignores a stale reconnect code on a successful server status', () => {
    showConnected({
      ...connected,
      sync: {
        status: 'succeeded',
        errorCode: 'reconnect_required',
        statusAt: '2026-08-16T12:00:00Z',
      },
    });
    renderCard();

    expect(screen.getByRole('button', { name: 'Sync now' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Reconnect Google Calendar' })
    ).not.toBeInTheDocument();
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
    renderCard('/app/settings/integrations?calendarConnection=error&reason=access_denied&keep=1');

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
    renderCard('/app/settings/integrations?calendarConnection=connected');

    expect(screen.getByText(/is connected\. Your study timeline/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('location-search')).toBeEmptyDOMElement());
  });

  it('opens an accessible calendar picker with saved selections and large targets', async () => {
    showConnected();
    renderCard();

    const openButton = screen.getByRole('button', { name: 'Calendar settings' });
    openButton.focus();
    fireEvent.click(openButton);
    expect(screen.getByRole('dialog', { name: 'Calendar settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close calendar settings' })).toHaveFocus();
    expect(screen.getByRole('checkbox', { name: /Andrew Primary/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Japanese lessons' })).toHaveClass('h-5', 'w-5');
    expect(screen.getByRole('textbox', { name: 'Event title term 1' })).toHaveValue('iTalki');
    expect(screen.getByRole('button', { name: 'Add title term' })).toHaveClass('min-h-11');
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Save settings' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Close calendar settings' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(openButton).toHaveFocus());
  });

  it('previews the current unsaved canonical choices without saving or refreshing settings', () => {
    showConnected();
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar settings' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Japanese lessons' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Event title term 1' }), {
      target: { value: '  Conversation class  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview matching events' }));

    expect(previewMutateMock).toHaveBeenCalledWith({
      calendarIds: ['primary', 'lessons'],
      titleMatchTerms: ['Conversation class', 'Japanese lesson'],
    });
    expect(previewResetMock).toHaveBeenCalledTimes(2);
    expect(saveMutateMock).not.toHaveBeenCalled();
    expect(refetchMock).not.toHaveBeenCalled();
  });

  it('shows server bounds, truncation, match details, and imported state as preview-only', () => {
    previewMock.mockReturnValue({
      mutate: previewMutateMock,
      reset: previewResetMock,
      isPending: false,
      isError: false,
      data: {
        generatedAt: '2026-08-15T12:00:00Z',
        startsAt: '2026-07-15T12:00:00Z',
        endsAt: '2026-08-15T12:00:00Z',
        scannedEventCount: 42,
        matchedEventCount: 3,
        truncated: true,
        matches: [
          {
            calendarId: 'primary',
            calendarName: 'Andrew',
            title: 'iTalki conversation lesson',
            startsAt: '2026-08-14T10:00:00Z',
            endsAt: '2026-08-14T11:00:00Z',
            durationMs: 3_600_000,
            matchedTerms: ['iTalki', 'lesson'],
            alreadySynced: true,
          },
          {
            calendarId: 'lessons',
            calendarName: 'Japanese lessons',
            title: 'Speaking practice',
            startsAt: '2026-08-13T15:00:00Z',
            endsAt: '2026-08-13T15:30:00Z',
            durationMs: 1_800_000,
            matchedTerms: ['practice'],
            alreadySynced: false,
          },
        ],
      },
    });
    showConnected();
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar settings' }));

    expect(screen.getByText(/Server search range:/)).toHaveTextContent('2026');
    expect(screen.getByText(/partial preview: showing 2 of 3/i)).toBeInTheDocument();
    expect(screen.getByText('iTalki conversation lesson')).toBeInTheDocument();
    expect(screen.getAllByText('Japanese lessons')).toHaveLength(2);
    expect(screen.getByLabelText(/to .*1h/)).toBeInTheDocument();
    expect(screen.getByText('Matched: iTalki, lesson')).toBeInTheDocument();
    expect(screen.getByText('Imported')).toBeInTheDocument();
    expect(screen.getByText('Not imported')).toBeInTheDocument();
    expect(screen.getByText(/42 events checked.*no study time was imported/i)).toBeInTheDocument();
  });

  it('shows empty, loading, and safe retry states without exposing provider details', () => {
    previewMock.mockReturnValue({
      mutate: previewMutateMock,
      reset: previewResetMock,
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('private provider detail'),
    });
    showConnected();
    const { rerender } = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar settings' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/couldn’t preview/i);
    expect(screen.queryByText(/private provider detail/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try preview again' }));
    expect(previewMutateMock).toHaveBeenCalledWith({
      calendarIds: ['primary'],
      titleMatchTerms: ['iTalki', 'Japanese lesson'],
    });

    previewMock.mockReturnValue({
      mutate: previewMutateMock,
      reset: previewResetMock,
      data: undefined,
      isPending: true,
      isError: false,
    });
    rerender(
      <MemoryRouter initialEntries={['/app/study/time']}>
        <GoogleCalendarConnectionCard />
      </MemoryRouter>
    );
    expect(screen.getByRole('status')).toHaveTextContent(/without importing anything/i);
    expect(screen.getByRole('button', { name: 'Checking…' })).toBeDisabled();

    previewMock.mockReturnValue({
      mutate: previewMutateMock,
      reset: previewResetMock,
      data: {
        generatedAt: '2026-08-15T12:00:00Z',
        startsAt: '2026-08-01T12:00:00Z',
        endsAt: '2026-08-15T12:00:00Z',
        scannedEventCount: 4,
        matchedEventCount: 0,
        truncated: false,
        matches: [],
      },
      isPending: false,
      isError: false,
    });
    rerender(
      <MemoryRouter initialEntries={['/app/study/time']}>
        <GoogleCalendarConnectionCard />
      </MemoryRouter>
    );
    expect(screen.getByText('No matching events')).toBeInTheDocument();
  });

  it('blocks preview and retry while a settings save is in flight', () => {
    saveSettingsMock.mockReturnValue({
      mutateAsync: saveMutateMock,
      isPending: true,
      isError: false,
    });
    previewMock.mockReturnValue({
      mutate: previewMutateMock,
      reset: previewResetMock,
      data: undefined,
      isPending: false,
      isError: true,
    });
    showConnected();
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar settings' }));

    expect(screen.getByRole('button', { name: 'Refresh preview' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Try preview again' })).toBeDisabled();
  });

  it('blocks preview while refreshing remote settings before save', async () => {
    refetchMock.mockReturnValue(new Promise(() => {}));
    previewMock.mockReturnValue({
      mutate: previewMutateMock,
      reset: previewResetMock,
      data: undefined,
      isPending: false,
      isError: true,
    });
    showConnected();
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Refresh preview' })).toBeDisabled()
    );
    expect(screen.getByRole('button', { name: 'Try preview again' })).toBeDisabled();
  });
  it('saves only changed calendar IDs while preserving every other setting', async () => {
    const opened = {
      ...connected,
      settings: { ...settings, calendarIds: ['primary', 'remote-removed'] },
    };
    refetchMock.mockResolvedValueOnce({
      isSuccess: true,
      data: {
        ...connected,
        settings: {
          calendarIds: ['primary', 'remote-added'],
          titleMatchTerms: ['Fresh rule'],
          syncEnabled: false,
        },
      },
    });
    showConnected(opened);
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar settings' }));
    saveMutateMock.mockImplementationOnce(async () => {
      expect(screen.getByRole('button', { name: 'Close calendar settings' })).toHaveFocus();
      return settings;
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /Andrew Primary/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Japanese lessons' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() =>
      expect(saveMutateMock).toHaveBeenCalledWith({
        calendarIds: ['remote-added', 'lessons'],
        titleMatchTerms: ['Fresh rule'],
        syncEnabled: false,
      })
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('three-way merges title edits with remote additions and fresh sync state', async () => {
    refetchMock.mockResolvedValueOnce({
      data: {
        ...connected,
        settings: {
          calendarIds: ['primary'],
          titleMatchTerms: ['iTalki', 'Japanese lesson', 'Remote lesson'],
          syncEnabled: false,
        },
      },
      isError: false,
    });
    showConnected();
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar settings' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Event title term 2' }), {
      target: { value: 'Conversation class' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() =>
      expect(saveMutateMock).toHaveBeenCalledWith({
        calendarIds: ['primary'],
        titleMatchTerms: ['iTalki', 'Remote lesson', 'Conversation class'],
        syncEnabled: false,
      })
    );
  });
  it('persists an explicit automatic-tracking toggle through the settings merge', async () => {
    refetchMock.mockResolvedValueOnce({ data: connected, isError: false });
    showConnected();
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar settings' }));
    const automatic = screen.getByRole('checkbox', { name: /Automatic tracking/i });
    expect(automatic).toBeChecked();
    expect(screen.getByText(/about every 15 minutes/i)).toBeInTheDocument();
    fireEvent.click(automatic);
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() =>
      expect(saveMutateMock).toHaveBeenCalledWith({
        ...settings,
        syncEnabled: false,
      })
    );
  });
  it('supports first-time setup without silently adding example terms', async () => {
    const firstTime = { ...connected, settings: null };
    showConnected(firstTime);
    refetchMock.mockResolvedValueOnce({ data: firstTime, isError: false });
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar settings' }));
    const term = screen.getByRole('textbox', { name: 'Event title term 1' });
    expect(term).toHaveValue('');
    expect(term).toHaveAttribute('placeholder', 'e.g. iTalki or lesson');
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /Andrew Primary/ }));
    fireEvent.change(term, { target: { value: '\u3000iTalki\u00a0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() =>
      expect(saveMutateMock).toHaveBeenCalledWith({
        calendarIds: ['primary'],
        titleMatchTerms: ['iTalki'],
        syncEnabled: false,
      })
    );
  });
  it('explains how to repair legacy-invalid title terms', () => {
    showConnected({ ...connected, settings: { ...settings, titleMatchTerms: ['   '] } });
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar settings' }));

    expect(screen.getByText(/saved title terms use older rules/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Event title term 1' })).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Event title term 1' }), {
      target: { value: 'lesson' },
    });
    expect(screen.queryByText(/saved title terms use older rules/i)).not.toBeInTheDocument();
  });
  it('shows and removes a selected calendar that is no longer available', () => {
    showConnected({
      ...connected,
      settings: { ...settings, calendarIds: ['primary', 'removed-id'] },
    });
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar settings' }));
    const unavailable = screen.getByRole('checkbox', { name: /removed-id.*unavailable/i });
    expect(unavailable).toBeChecked();
    fireEvent.click(unavailable);
    expect(screen.queryByText('removed-id')).not.toBeInTheDocument();
  });
  it('enforces the 25-calendar selection limit until one is removed', () => {
    const calendars = Array.from({ length: 26 }, (_, index) => ({
      id: `calendar-${index}`,
      name: `Calendar ${index + 1}`,
      primary: index === 0,
    }));
    showConnected({
      ...connected,
      settings: { ...settings, calendarIds: calendars.slice(0, 25).map((c) => c.id) },
    });
    calendarListMock.mockReturnValue({
      data: { calendars, truncated: false },
      isLoading: false,
      isError: false,
      isSuccess: true,
      refetch: calendarRefetchMock,
    });
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar settings' }));
    expect(screen.getByText(/select up to 25 calendars/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Calendar 26' })).toBeDisabled();
  });

  it('requires one calendar and cancel discards the draft', () => {
    showConnected();
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar settings' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Andrew Primary/ }));
    expect(screen.getByRole('alert')).toHaveTextContent(/select at least one calendar/i);
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(saveMutateMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar settings' }));
    expect(screen.getByRole('checkbox', { name: /Andrew Primary/ })).toBeChecked();
  });
  it('shows calendar loading, safe error with retry, and empty states', () => {
    showConnected();
    calendarListMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isSuccess: false,
      refetch: calendarRefetchMock,
    });
    let view = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar settings' }));
    expect(screen.getByText(/loading your calendars/i)).toBeInTheDocument();
    view.unmount();
    calendarListMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isSuccess: false,
      refetch: calendarRefetchMock,
    });
    view = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar settings' }));
    expect(screen.getByRole('alert')).not.toHaveTextContent('private provider detail');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(calendarRefetchMock).toHaveBeenCalledOnce();
    view.unmount();
    calendarListMock.mockReturnValue({
      data: { calendars: [], truncated: false },
      isLoading: false,
      isError: false,
      isSuccess: true,
      refetch: calendarRefetchMock,
    });
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar settings' }));
    expect(screen.getByText('No calendars found')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(calendarRefetchMock).toHaveBeenCalledTimes(2);
  });
  it('can close safely while refresh or save transport is stalled', async () => {
    showConnected();
    let finishRefresh!: (result: unknown) => void;
    refetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        finishRefresh = resolve;
      })
    );
    const view = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close calendar settings' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    view.unmount();
    finishRefresh({ data: connected, isError: false });
    await Promise.resolve();
    expect(saveMutateMock).not.toHaveBeenCalled();
    saveMutateMock.mockReturnValueOnce(new Promise(() => {}));
    refetchMock.mockResolvedValueOnce({ data: connected, isError: false });
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => expect(saveMutateMock).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('shows actionable feedback when a concurrent merge exceeds the limit', async () => {
    showConnected();
    refetchMock.mockResolvedValueOnce({
      data: {
        ...connected,
        settings: { ...settings, calendarIds: Array.from({ length: 25 }, (_, i) => `remote-${i}`) },
      },
      isError: false,
    });
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar settings' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Japanese lessons' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByText(/select up to 25 calendars/i)).toBeInTheDocument();
    expect(saveMutateMock).not.toHaveBeenCalled();
  });
  it('shows actionable feedback for merged title-term caps and settings conflicts', async () => {
    showConnected();
    refetchMock.mockResolvedValueOnce({
      data: {
        ...connected,
        settings: {
          ...settings,
          titleMatchTerms: Array.from({ length: 50 }, (_, index) => `remote-${index}`),
        },
      },
      isError: false,
    });
    const view = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add title term' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Event title term 3' }), {
      target: { value: 'New local term' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByText(/save up to 50 title terms/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    view.unmount();

    refetchMock.mockResolvedValueOnce({
      data: { ...connected, settings: null },
      isError: false,
    });
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByText(/changed elsewhere.*reopen/i)).toBeInTheDocument();
    expect(saveMutateMock).not.toHaveBeenCalled();
  });
  it('does not save stale cached settings when the pre-save refresh fails', async () => {
    showConnected();
    refetchMock.mockResolvedValueOnce({ data: connected, isError: true, error: new Error() });
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/couldn’t save your calendar settings/i)
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(saveMutateMock).not.toHaveBeenCalled();
  });
});
