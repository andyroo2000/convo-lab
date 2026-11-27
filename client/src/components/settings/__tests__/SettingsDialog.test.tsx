import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, MemoryRouter, Route, useLocation } from 'react-router-dom';
import SettingsModalRoutes from '../SettingsModalRoutes';
import i18n from '../../../i18n';
import SettingsDialog from '../SettingsDialog';
import MobileLearningDock from '../../common/MobileLearningDock';

const auth = vi.hoisted(() => ({
  user: { id: '1', role: 'user', name: 'Andrew', email: 'andrew@example.com' },
  logout: vi.fn(),
  updateUser: vi.fn(),
}));
vi.mock('../WaniKaniConnectionCard', () => ({
  default: () => <p>WaniKani connection</p>,
}));

const calendarMount = vi.hoisted(() => vi.fn());
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../study/GoogleCalendarConnectionCard', () => ({
  default: () => {
    calendarMount();
    return <p>Google Calendar connection</p>;
  },
}));

vi.mock('../../../pages/StudySettingsPage', () => ({ default: () => <p>Daily new cards</p> }));

const JournalDraft = () => {
  const [draft, setDraft] = useState('');
  const location = useLocation();
  return (
    <>
      <input
        aria-label="Journal draft"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <MobileLearningDock />
      <Link to="/app/settings" state={{ backgroundLocation: location }}>
        Open settings
      </Link>
    </>
  );
};

function setup(enabled: boolean | undefined = false, route = '/app/journal') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  if (enabled !== undefined)
    client.setQueryData(['featureFlags', auth.user.id], { flashcardsEnabled: enabled });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <SettingsModalRoutes>
          <Route path="/app/journal" element={<JournalDraft />} />
          <Route path="/app/settings/:tab?" element={<SettingsDialog />} />
        </SettingsModalRoutes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return client;
}

async function openSettings() {
  fireEvent.click(screen.getByText('Open settings'));
  return screen.findByRole('dialog', { name: 'Settings' });
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.user.role = 'user';
  HTMLDialogElement.prototype.showModal = function show() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
  };
});

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('Journal settings modal', () => {
  it('preserves the current Journal draft when closing settings', async () => {
    setup();
    fireEvent.change(screen.getByLabelText('Journal draft'), {
      target: { value: '今日はいい日です。' },
    });
    await openSettings();
    expect(screen.getAllByRole('button', { name: 'Sign out' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }));
    expect(screen.getByLabelText('Journal draft')).toHaveValue('今日はいい日です。');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('preserves the Journal draft from the mobile dock entry point', async () => {
    setup(true);
    fireEvent.change(screen.getByLabelText('Journal draft'), { target: { value: 'Mobile draft' } });
    fireEvent.click(screen.getByTestId('mobile-learning-dock-settings'));
    await screen.findByRole('dialog', { name: 'Settings' });
    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }));
    expect(screen.getByLabelText('Journal draft')).toHaveValue('Mobile draft');
  });

  it('offers WaniKani without enabling Study or Calendar for a non-admin', () => {
    setup(false, '/app/settings/integrations');
    expect(screen.getByRole('button', { name: 'Connections' })).toBeInTheDocument();
    expect(screen.getByText('WaniKani connection')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Study preferences' })).not.toBeInTheDocument();
    expect(calendarMount).not.toHaveBeenCalled();
  });

  it.each(['enabled user', 'admin override'])(
    'allows Calendar for %s and collapses Account',
    async (scenario) => {
      auth.user.role = scenario === 'admin override' ? 'admin' : 'user';
      setup(scenario === 'enabled user');
      await openSettings();
      fireEvent.click(screen.getByRole('button', { name: 'Connections' }));
      expect(screen.getByText('Google Calendar connection')).toBeInTheDocument();
      expect(screen.getByText('WaniKani connection')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Edit profile' })).not.toBeInTheDocument();
    }
  );

  it('opens Study preferences within the current dialog', async () => {
    setup(true);
    const dialog = await openSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Study preferences' }));
    expect(dialog).toContainElement(screen.getByText('Daily new cards'));
  });

  it('opens the Study chapter from its direct URL', () => {
    setup(true, '/app/settings/study');
    expect(screen.getByRole('button', { name: 'Study preferences' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  it('removes Calendar when the Study feature is revoked', async () => {
    const client = setup(true, '/app/settings/integrations');
    expect(screen.getByText('Google Calendar connection')).toBeInTheDocument();
    client.setQueryData(['featureFlags', auth.user.id], { flashcardsEnabled: false });
    await waitFor(() =>
      expect(screen.queryByText('Google Calendar connection')).not.toBeInTheDocument()
    );
  });

  it('opens the labeled profile editor without a second close or footer action', async () => {
    setup();
    await openSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }));
    expect(screen.getByRole('dialog', { name: 'Account settings' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('andrew@example.com');
    expect(screen.getAllByRole('button', { name: 'Close settings' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to settings' }));
    expect(screen.getByRole('button', { name: 'Edit profile' })).toBeInTheDocument();
  });

  it('keeps the open chapter and its control ID when switching languages', async () => {
    setup(true, '/app/settings');
    fireEvent.click(screen.getByRole('button', { name: 'Connections' }));
    await i18n.changeLanguage('ja');
    expect(screen.getByRole('dialog', { name: '設定' })).toBeInTheDocument();
    const chapter = screen.getByRole('button', { name: '連携' });
    expect(chapter).toHaveAttribute('aria-expanded', 'true');
    expect(chapter).toHaveAttribute('aria-controls', 'settings-connections');
    fireEvent.click(screen.getByRole('button', { name: 'アカウント' }));
    expect(screen.getByRole('button', { name: 'プロフィールを編集' })).toBeInTheDocument();
  });

  it('dismisses a direct settings visit with Escape to Journal', () => {
    setup(false, '/app/settings');
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(screen.getByLabelText('Journal draft')).toBeInTheDocument();
  });
});
