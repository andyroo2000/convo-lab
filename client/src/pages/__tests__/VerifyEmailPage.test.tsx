import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import VerifyEmailPage from '../VerifyEmailPage';

const API_URL = 'http://localhost:3001';

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
const mockUser = { id: '1', email: 'test@example.com', emailVerified: false };
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    refreshUser: mockRefreshUser,
  }),
}));

// Mock global fetch
global.fetch = vi.fn();

function renderWithRouter(initialRoute = '/verify-email') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
        <Route path="/app/library" element={<div>Library Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.emailVerified = false;
    (global.fetch as any).mockClear();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Token Verification', () => {
    it('should show verifying state initially when token is present', () => {
      renderWithRouter('/verify-email/test-token-123');

      expect(screen.getByText('Verifying your email...')).toBeInTheDocument();
      expect(screen.getByText('Please wait while we verify your email address.')).toBeInTheDocument();
    });

    it('should successfully verify valid token', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Email verified successfully' }),
      });

      renderWithRouter('/verify-email/valid-token');

      await waitFor(() => {
        expect(screen.getByText('Email Verified!')).toBeInTheDocument();
      });

      expect(screen.getByText(/Your email has been successfully verified/)).toBeInTheDocument();
      expect(screen.getByText(/Redirecting to your library/)).toBeInTheDocument();

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_URL}/api/verification/valid-token`,
        { credentials: 'include' }
      );

      expect(mockRefreshUser).toHaveBeenCalled();
    });

    it('should redirect to library after successful verification', async () => {
      vi.useFakeTimers();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Email verified successfully' }),
      });

      renderWithRouter('/verify-email/valid-token');

      await waitFor(() => {
        expect(screen.getByText('Email Verified!')).toBeInTheDocument();
      });

      vi.advanceTimersByTime(3000);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/app/library');
      });

      vi.useRealTimers();
    });

    it('should show error for invalid token', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid or expired verification token' }),
      });

      renderWithRouter('/verify-email/invalid-token');

      await waitFor(() => {
        expect(screen.getByText('Verification Failed')).toBeInTheDocument();
      });

      expect(screen.getByText('Invalid or expired verification token')).toBeInTheDocument();
    });

    it('should show error for expired token', async () => {
      (global.fetch as any).mockResolvedValueOnce({
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
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      renderWithRouter('/verify-email/network-fail-token');

      await waitFor(() => {
        expect(screen.getByText('Verification Failed')).toBeInTheDocument();
      });

      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  describe('Resend Verification Email', () => {
    it('should show resend button when verification fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
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
      (global.fetch as any)
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
        `${API_URL}/api/verification/send`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );
    });

    it('should show sending state while resending email', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Token has expired' }),
        })
        .mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 1000)));

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
      (global.fetch as any)
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
      expect(screen.getByText(mockUser.email)).toBeInTheDocument();
    });

    it('should allow resending verification email from no-token state', async () => {
      mockUser.emailVerified = false;

      (global.fetch as any).mockResolvedValueOnce({
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

      (global.fetch as any).mockResolvedValueOnce({
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
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Email verified successfully' }),
      });

      renderWithRouter('/verify-email/valid-token');

      await waitFor(() => {
        expect(screen.getByText('Email Verified!')).toBeInTheDocument();
      });

      // Check for CheckCircle icon (you may need to adjust based on how lucide-react renders)
      const successIcon = document.querySelector('.text-green-500');
      expect(successIcon).toBeInTheDocument();
    });

    it('should show error icon on verification failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid token' }),
      });

      renderWithRouter('/verify-email/invalid-token');

      await waitFor(() => {
        expect(screen.getByText('Verification Failed')).toBeInTheDocument();
      });

      // Check for XCircle icon
      const errorIcon = document.querySelector('.text-red-500');
      expect(errorIcon).toBeInTheDocument();
    });
  });
});
