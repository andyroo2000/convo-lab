import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ClaimInvitePage from '../ClaimInvitePage';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  authApi: {
    claimInvite: '/api/convolab/browser/auth/google/invite',
    claimInviteRequiresToken: false,
    claimInviteBody: (inviteCode: string) => ({ inviteCode }),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock('../../lib/authApi', () => ({
  authApi: mocks.authApi,
}));

function renderPage(route = '/claim-invite') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ClaimInvitePage />
    </MemoryRouter>
  );
}

describe('ClaimInvitePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authApi.claimInvite = '/api/convolab/browser/auth/google/invite';
    mocks.authApi.claimInviteRequiresToken = false;
    mocks.authApi.claimInviteBody = (inviteCode: string) => ({ inviteCode });
    vi.stubGlobal('fetch', vi.fn());
  });

  it('claims a direct Learning OS pending session without a URL token', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Invalid invite code' }),
    } as Response);

    renderPage();
    fireEvent.change(screen.getByLabelText('Invite Code'), {
      target: { value: 'WELCOME1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/convolab/browser/auth/google/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ inviteCode: 'WELCOME1' }),
      });
    });
    expect(screen.getByText('Invalid invite code')).toBeInTheDocument();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('preserves the legacy token requirement while direct routing is disabled', () => {
    mocks.authApi.claimInvite = '/api/auth/claim-invite';
    mocks.authApi.claimInviteRequiresToken = true;
    mocks.authApi.claimInviteBody = (inviteCode: string) => ({
      inviteCode,
      token: 'legacy-token',
    });

    renderPage();

    expect(mocks.navigate).toHaveBeenCalledWith('/login?error=missing_token');
    expect(screen.queryByLabelText('Invite Code')).not.toBeInTheDocument();
  });
});
