import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import VerifyEmailPage from '../VerifyEmailPage';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock AuthContext
const mockRefreshUser = vi.fn();
let mockUser = { id: '1', email: 'test@example.com', emailVerified: false };

// Create a getter function to always return the current mockUser value
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    get user() {
      return mockUser;
    },
    refreshUser: mockRefreshUser,
  }),
}));

// Mock global fetch
global.fetch = vi.fn() as unknown as typeof fetch;

function verificationRoutes(withTokenSwitch = false) {
  return (
    <>
      {withTokenSwitch && (
        <>
          <Link to="/verify-email/token-b">Switch token</Link>
          <Link to="/verify-email">Remove token</Link>
        </>
      )}
      <Routes>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
        <Route path="/app/library" element={<div>Library Page</div>} />
      </Routes>
    </>
  );
}

function renderWithRouter(initialRoute = '/verify-email', strict = false, withTokenSwitch = false) {
  const view = (
    <MemoryRouter initialEntries={[initialRoute]}>
      {verificationRoutes(withTokenSwitch)}
    </MemoryRouter>
  );

  return render(strict ? <StrictMode>{view}</StrictMode> : view);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mockUser to a fresh object
    mockUser = { id: '1', email: 'test@example.com', emailVerified: false };
    (global.fetch as ReturnType<typeof vi.fn>).mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('Token Verification', () => {
    it('should show verifying state initially when token is present', () => {
      renderWithRouter('/verify-email/test-token-123');

      expect(screen.getByText('Verifying your email...')).toBeInTheDocument();
      expect(
        screen.getByText('Please wait while we verify your email address.')
      ).toBeInTheDocument();
    });

    it('should successfully verify valid token', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Email verified successfully' }),
      });

      renderWithRouter('/verify-email/valid-token');

      await waitFor(() => {
        expect(screen.getByText('Email Verified!')).toBeInTheDocument();
      });

      expect(screen.getByText(/Your email has been successfully verified/)).toBeInTheDocument();
      expect(screen.getByText(/Redirecting to your library/)).toBeInTheDocument();

      expect(global.fetch).toHaveBeenCalledWith('/api/convolab/browser/auth/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'valid-token' }),
        credentials: 'include',
        signal: expect.any(AbortSignal),
      });

      expect(mockRefreshUser).toHaveBeenCalled();
    });

    it('should redirect to library after successful verification', async () => {
      vi.useFakeTimers();
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Email verified successfully' }),
      });

      renderWithRouter('/verify-email/valid-token');

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByText('Email Verified!')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(mockNavigate).toHaveBeenCalledWith('/app/library');
    });

    it('owns a single-use token once during StrictMode effect replay', async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Verification token has already been consumed' }),
        });

      renderWithRouter('/verify-email/single-use-token', true);

      expect(await screen.findByText('Email Verified!')).toBeInTheDocument();
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByText('Verification token has already been consumed')
      ).not.toBeInTheDocument();
    });

    it('ignores a stale token response after the route changes', async () => {
      const tokenA = deferred<Response>();
      const tokenB = deferred<Response>();
      const requests: Array<{ token: string; signal: AbortSignal }> = [];
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((_url, init) => {
        const body = JSON.parse(String((init as RequestInit).body)) as { token: string };
        requests.push({ token: body.token, signal: (init as RequestInit).signal as AbortSignal });
        return body.token === 'token-a' ? tokenA.promise : tokenB.promise;
      });

      renderWithRouter('/verify-email/token-a', false, true);
      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

      fireEvent.click(screen.getByRole('link', { name: 'Switch token' }));
      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
      expect(requests.find((request) => request.token === 'token-a')?.signal.aborted).toBe(true);

      tokenB.resolve({ ok: true } as Response);
      expect(await screen.findByText('Email Verified!')).toBeInTheDocument();

      tokenA.resolve({
        ok: false,
        json: async () => ({ error: 'Stale token error' }),
      } as Response);
      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.getByText('Email Verified!')).toBeInTheDocument();
      expect(screen.queryByText('Stale token error')).not.toBeInTheDocument();
    });

    it('aborts verification and clears its redirect when unmounted', async () => {
      vi.useFakeTimers();
      const response = deferred<Response>();
      let signal: AbortSignal | undefined;
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((_url, init) => {
        signal = (init as RequestInit).signal as AbortSignal;
        return response.promise;
      });

      const { unmount } = renderWithRouter('/verify-email/unmounted-token');
      await act(async () => {
        await Promise.resolve();
      });
      expect(signal?.aborted).toBe(false);

      response.resolve({ ok: true } as Response);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByText('Email Verified!')).toBeInTheDocument();

      unmount();
      expect(signal?.aborted).toBe(true);
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('keeps successful verification when refreshing the user fails', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true });
      mockRefreshUser.mockRejectedValueOnce(new Error('Account refresh failed'));

      renderWithRouter('/verify-email/valid-token');

      expect(await screen.findByText('Email Verified!')).toBeInTheDocument();
      expect(screen.queryByText('Account refresh failed')).not.toBeInTheDocument();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('clears the redirect and token-scoped state when the token is removed', async () => {
      vi.useFakeTimers();
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true });

      renderWithRouter('/verify-email/valid-token', false, true);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByText('Email Verified!')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('link', { name: 'Remove token' }));
      expect(screen.getByText('Verify Your Email')).toBeInTheDocument();
      expect(screen.queryByText('Email Verified!')).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should show error for invalid token', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid or expired verification token' }),
      });

      renderWithRouter('/verify-email/invalid-token');

      await waitFor(
        () => {
          expect(global.fetch).toHaveBeenCalledWith(
            '/api/convolab/browser/auth/verification',
            expect.objectContaining({
              method: 'POST',
              body: JSON.stringify({ token: 'invalid-token' }),
              credentials: 'include',
            })
          );
        },
        { timeout: 10000 }
      );

      await waitFor(
        () => {
          expect(screen.getByText('Verification Failed')).toBeInTheDocument();
        },
        { timeout: 10000 }
      );

      expect(screen.getByText('Invalid or expired verification token')).toBeInTheDocument();
    });

    it('should show error for expired token', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Token has expired' }),
      });

      renderWithRouter('/verify-email/expired-token');

      await waitFor(() => {
        expect(screen.getByText('Verification Failed')).toBeInTheDocument();
      });

      expect(screen.getByText('Token has expired')).toBeInTheDocument();
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

      renderWithRouter('/verify-email/network-fail-token');

      await waitFor(() => {
        expect(screen.getByText('Verification Failed')).toBeInTheDocument();
      });

      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  describe('Resend Verification Email', () => {
    it('should show resend button when verification fails', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Token has expired' }),
      });

      renderWithRouter('/verify-email/expired-token');

      await waitFor(() => {
        expect(screen.getByText('Verification Failed')).toBeInTheDocument();
      });

      const resendButton = screen.getByRole('button', { name: /Resend Verification Email/ });
      expect(resendButton).toBeInTheDocument();
    });

    it('should successfully resend verification email', async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Token has expired' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: 'Verification email sent' }),
        });

      renderWithRouter('/verify-email/expired-token');

      await waitFor(() => {
        expect(screen.getByText('Verification Failed')).toBeInTheDocument();
      });

      const resendButton = screen.getByRole('button', { name: /Resend Verification Email/ });
      fireEvent.click(resendButton);

      await waitFor(() => {
        expect(screen.getByText('Verification email sent! Check your inbox.')).toBeInTheDocument();
      });

      expect(global.fetch).toHaveBeenLastCalledWith(
        '/api/convolab/browser/auth/verification/send',
        {
          method: 'POST',
          credentials: 'include',
        }
      );
    });

    it('should show sending state while resending email', async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Token has expired' }),
        })
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              setTimeout(resolve, 1000);
            })
        );

      renderWithRouter('/verify-email/expired-token');

      await waitFor(() => {
        expect(screen.getByText('Verification Failed')).toBeInTheDocument();
      });

      const resendButton = screen.getByRole('button', { name: /Resend Verification Email/ });
      fireEvent.click(resendButton);

      expect(screen.getByRole('button', { name: /Sending.../ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sending.../ })).toBeDisabled();
    });

    it('should handle resend email errors', async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Token has expired' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Email already verified' }),
        });

      renderWithRouter('/verify-email/expired-token');

      await waitFor(() => {
        expect(screen.getByText('Verification Failed')).toBeInTheDocument();
      });

      const resendButton = screen.getByRole('button', { name: /Resend Verification Email/ });
      fireEvent.click(resendButton);

      await waitFor(() => {
        expect(screen.getByText('Email already verified')).toBeInTheDocument();
      });
    });
  });

  describe('Already Verified State', () => {
    it('should show already verified message when user is already verified', () => {
      mockUser.emailVerified = true;

      renderWithRouter('/verify-email');

      expect(screen.getByText('Email Already Verified')).toBeInTheDocument();
      expect(screen.getByText(/Your email is already verified/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Go to Library/ })).toBeInTheDocument();
    });
  });

  describe('No Token State', () => {
    it('should show verification instructions when no token and user not verified', () => {
      mockUser.emailVerified = false;

      renderWithRouter('/verify-email');

      expect(screen.getByText('Verify Your Email')).toBeInTheDocument();
      expect(screen.getByText(/We sent a verification email to/)).toBeInTheDocument();
      // The email is embedded in the translation string, not rendered separately
      expect(screen.getByText(/test@example\.com/)).toBeInTheDocument();
    });

    it('should allow resending verification email from no-token state', async () => {
      mockUser.emailVerified = false;

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Verification email sent' }),
      });

      renderWithRouter('/verify-email');

      const resendButton = screen.getByRole('button', { name: /Resend Verification Email/ });
      fireEvent.click(resendButton);

      await waitFor(() => {
        expect(screen.getByText('Verification email sent! Check your inbox.')).toBeInTheDocument();
      });
    });

    it('should show error when resend fails in no-token state', async () => {
      mockUser.emailVerified = false;

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Server error' }),
      });

      renderWithRouter('/verify-email');

      const resendButton = screen.getByRole('button', { name: /Resend Verification Email/ });
      fireEvent.click(resendButton);

      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeInTheDocument();
      });
    });
  });

  describe('UI Elements', () => {
    it('should render logo and title', () => {
      renderWithRouter('/verify-email');

      expect(screen.getByRole('heading', { name: /ConvoLab/ })).toBeInTheDocument();
      expect(screen.getByText('Email Verification')).toBeInTheDocument();
    });

    it('should render back to library link', () => {
      renderWithRouter('/verify-email');

      const backLink = screen.getByRole('link', { name: /Back to Library/ });
      expect(backLink).toBeInTheDocument();
      expect(backLink).toHaveAttribute('href', '/app/library');
    });

    it('should show success icon on successful verification', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Email verified successfully' }),
      });

      renderWithRouter('/verify-email/valid-token');

      await waitFor(() => {
        expect(screen.getByText('Email Verified!')).toBeInTheDocument();
      });

      // Check for CheckCircle icon (you may need to adjust based on how lucide-react renders)
      // eslint-disable-next-line testing-library/no-node-access
      const successIcon = document.querySelector('.text-green-500');
      expect(successIcon).toBeInTheDocument();
    });

    it('should show error icon on verification failure', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid token' }),
      });

      renderWithRouter('/verify-email/invalid-token');

      await waitFor(() => {
        expect(screen.getByText('Verification Failed')).toBeInTheDocument();
      });

      // Check for XCircle icon
      // eslint-disable-next-line testing-library/no-node-access
      const errorIcon = document.querySelector('.text-red-500');
      expect(errorIcon).toBeInTheDocument();
    });
  });
});
