import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VerifyEmailPage from '../VerifyEmailPage';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  refreshUser: vi.fn(),
  authApi: {
    verifyEmail: (token: string) => ({
      url: '/api/convolab/browser/auth/verification',
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include' as const,
        body: JSON.stringify({ token }),
      },
    }),
    resendVerification: '/api/convolab/browser/auth/verification/send',
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'test@example.com', emailVerified: false },
    refreshUser: mocks.refreshUser,
  }),
}));

vi.mock('../../lib/authApi', () => ({
  authApi: mocks.authApi,
}));

function renderPage(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('VerifyEmailPage with direct Learning OS auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('posts the email token to the browser verification endpoint', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({ ok: true } as Response);

    renderPage('/verify-email/verification-token');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/convolab/browser/auth/verification',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({ token: 'verification-token' }),
        })
      );
    });
    expect(await screen.findByText('Email Verified!')).toBeInTheDocument();
    expect(mocks.refreshUser).toHaveBeenCalled();
  });

  it('resends verification through the authenticated browser endpoint', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({ ok: true } as Response);

    renderPage('/verify-email');
    fireEvent.click(screen.getByRole('button', { name: 'Resend Verification Email' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/convolab/browser/auth/verification/send', {
        method: 'POST',
        credentials: 'include',
      });
    });
    expect(screen.getByText('Verification email sent! Check your inbox.')).toBeInTheDocument();
  });
});
