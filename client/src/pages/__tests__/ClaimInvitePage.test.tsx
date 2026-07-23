import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ClaimInvitePage from '../ClaimInvitePage';

const mocks = vi.hoisted(() => ({
  authApi: {
    claimInvite: '/api/convolab/browser/auth/google/invite',
    claimInviteBody: (inviteCode: string) => ({ inviteCode }),
  },
}));

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
  });
});
