import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WaniKaniConnectionCard from '../WaniKaniConnectionCard';

const state = vi.hoisted(() => ({
  query: {
    data: undefined as
      | undefined
      | { wanikani: { connected: boolean; lastSyncedAt: string | null } },
    isLoading: false,
    isError: false,
  },
  connect: vi.fn(),
  sync: vi.fn(),
  disconnect: vi.fn(),
}));
vi.mock('../../../hooks/useKnownKanji', () => ({
  useKnownKanji: () => state.query,
  useConnectWaniKani: () => ({ mutateAsync: state.connect }),
  useSyncWaniKani: () => ({ mutateAsync: state.sync, isPending: false }),
  useDisconnectWaniKani: () => ({ mutateAsync: state.disconnect }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  state.query = {
    data: { wanikani: { connected: false, lastSyncedAt: null } },
    isLoading: false,
    isError: false,
  };
  state.connect.mockResolvedValue(undefined);
  state.sync.mockResolvedValue(undefined);
  state.disconnect.mockResolvedValue(undefined);
});

function connect() {
  fireEvent.change(screen.getByLabelText('WaniKani API token'), {
    target: { value: '  test-read-token  ' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Connect and sync' }));
}

it('masks the token, trims it, and clears it after connecting before syncing', async () => {
  render(<WaniKaniConnectionCard />);
  expect(screen.getByLabelText('WaniKani API token')).toHaveAttribute('type', 'password');
  expect(screen.getByRole('button', { name: 'Connect and sync' })).toBeDisabled();
  connect();
  await waitFor(() => expect(state.sync).toHaveBeenCalledOnce());
  expect(state.connect).toHaveBeenCalledWith('test-read-token');
  expect(screen.getByLabelText('WaniKani API token')).toHaveValue('');
});

it('shows connection failures and does not sync a rejected connection', async () => {
  state.connect.mockRejectedValue(new Error('Invalid token'));
  render(<WaniKaniConnectionCard />);
  connect();
  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid token');
  expect(state.sync).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Connect and sync' })).toBeEnabled();
});

it('shows a sync failure after connecting without keeping the token', async () => {
  state.sync.mockRejectedValue(new Error('Sync unavailable'));
  render(<WaniKaniConnectionCard />);
  connect();
  expect(await screen.findByRole('alert')).toHaveTextContent('Sync unavailable');
  expect(screen.getByLabelText('WaniKani API token')).toHaveValue('');
});

it('offers sync and disconnect for an existing connection and reports disconnect errors', async () => {
  state.query.data = { wanikani: { connected: true, lastSyncedAt: null } };
  state.disconnect.mockRejectedValue(new Error('Disconnect unavailable'));
  render(<WaniKaniConnectionCard />);
  expect(screen.queryByLabelText('WaniKani API token')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Sync now' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Disconnect' })).toBeEnabled());
  expect(state.sync).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Disconnect unavailable');
});

it.each(['loading', 'failed'])('does not offer connection changes while status is %s', (status) => {
  state.query = { data: undefined, isLoading: status === 'loading', isError: status === 'failed' };
  render(<WaniKaniConnectionCard />);
  expect(screen.getByRole(status === 'loading' ? 'status' : 'alert')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Connect and sync' })).not.toBeInTheDocument();
});
