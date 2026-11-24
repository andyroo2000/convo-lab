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
    sessionStorage.clear();
    mocks.authApi.claimInvite = '/api/convolab/browser/auth/google/invite';
    mocks.authApi.claimInviteBody = (inviteCode: string) => ({ inviteCode });
    vi.stubGlobal('fetch', vi.fn());
  });

  it('prefills the invitation carried through Google sign-in', () => {
    sessionStorage.setItem('convolab.beta-invite', 'WELCOME8');
    renderPage();
    expect(screen.getByLabelText('Invite Code')).toHaveValue('WELCOME8');
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
  it.each([
    ['/claim-invite', '/app/journal'],
    [
      '/claim-invite?returnUrl=%2Fapp%2Fjournal%2F01abc%3Fdraft%3D1%23correction',
      '/app/journal/01abc?draft=1#correction',
    ],
    ['/claim-invite?returnUrl=https%3A%2F%2Fevil.example', '/app/journal'],
  ])('opens a safe destination after accepting an invite at %s', async (route, expected) => {
    sessionStorage.setItem('convolab.beta-invite', 'WELCOME1');
    const location = { href: '/claim-invite' };
    vi.stubGlobal('location', location);
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    renderPage(route);
    fireEvent.change(screen.getByLabelText('Invite Code'), { target: { value: 'WELCOME1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(location.href).toBe(expected));
    expect(sessionStorage.getItem('convolab.beta-invite')).toBeNull();
    vi.unstubAllGlobals();
  });
});
