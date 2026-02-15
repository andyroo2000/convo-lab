import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ResetPasswordPage from '../ResetPasswordPage';

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

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function renderWithRouter(initialRoute = '/reset-password/test-token') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('Token Validation', () => {
    it('should validate token on mount', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true, email: 'test@example.com' }),
      });

      renderWithRouter('/reset-password/valid-token');

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(`${API_URL}/api/password-reset/valid-token`, {
          credentials: 'include',
        });
      });
    });

    it('should show loading state during validation', () => {
      mockFetch.mockImplementationOnce(
        () => new Promise(() => {}) // Never resolves
      );

      renderWithRouter('/reset-password/test-token');

      expect(screen.getByText(/Validating reset link/i)).toBeInTheDocument();
    });

    it('should show form with email when token is valid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true, email: 'test@example.com' }),
      });

      renderWithRouter('/reset-password/valid-token');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Reset Password/i })).toBeInTheDocument();
      });

      expect(screen.getByText(/test@example\.com/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/New Password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Confirm Password/i)).toBeInTheDocument();
    });

    it('should show error for invalid token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid or expired token' }),
      });

      renderWithRouter('/reset-password/invalid-token');

      await waitFor(() => {
        expect(screen.getByText(/Invalid or expired token/i)).toBeInTheDocument();
      });
    });

    it('should show error when token is missing', async () => {
      renderWithRouter('/reset-password');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Invalid Reset Link/i })).toBeInTheDocument();
      });
    });
  });

  describe('Password Reset Form', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true, email: 'test@example.com' }),
      });
    });

    it('should render password input fields', async () => {
      renderWithRouter('/reset-password/valid-token');

      await waitFor(() => {
        expect(screen.getByLabelText(/New Password/i)).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/Confirm Password/i)).toBeInTheDocument();
    });

    it('should show password mismatch error', async () => {
      renderWithRouter('/reset-password/valid-token');

      await waitFor(() => {
        expect(screen.getByLabelText(/New Password/i)).toBeInTheDocument();
      });

      const newPassword = screen.getByLabelText(/New Password/i);
      const confirmPassword = screen.getByLabelText(/Confirm Password/i);
      const submitButton = screen.getByRole('button', { name: /Reset Password/i });

      fireEvent.change(newPassword, { target: { value: 'password123' } });
      fireEvent.change(confirmPassword, { target: { value: 'different123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
      });
    });

    it('should show error for short password', async () => {
      renderWithRouter('/reset-password/valid-token');

      await waitFor(() => {
        expect(screen.getByLabelText(/New Password/i)).toBeInTheDocument();
      });

      const newPassword = screen.getByLabelText(/New Password/i);
      const confirmPassword = screen.getByLabelText(/Confirm Password/i);
      const submitButton = screen.getByRole('button', { name: /Reset Password/i });

      fireEvent.change(newPassword, { target: { value: 'short' } });
      fireEvent.change(confirmPassword, { target: { value: 'short' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Password must be at least 8 characters/i)).toBeInTheDocument();
      });
    });

    it('should successfully reset password', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Password reset successfully' }),
      });

      renderWithRouter('/reset-password/valid-token');

      await waitFor(() => {
        expect(screen.getByLabelText(/New Password/i)).toBeInTheDocument();
      });

      const newPassword = screen.getByLabelText(/New Password/i);
      const confirmPassword = screen.getByLabelText(/Confirm Password/i);
      const submitButton = screen.getByRole('button', { name: /Reset Password/i });

      fireEvent.change(newPassword, { target: { value: 'newpassword123' } });
      fireEvent.change(confirmPassword, { target: { value: 'newpassword123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Password Reset/i })).toBeInTheDocument();
      });
    });

    it('should call API with token and new password', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Password reset successfully' }),
      });

      renderWithRouter('/reset-password/valid-token');

      await waitFor(() => {
        expect(screen.getByLabelText(/New Password/i)).toBeInTheDocument();
      });

      const newPassword = screen.getByLabelText(/New Password/i);
      const confirmPassword = screen.getByLabelText(/Confirm Password/i);
      const submitButton = screen.getByRole('button', { name: /Reset Password/i });

      fireEvent.change(newPassword, { target: { value: 'newpassword123' } });
      fireEvent.change(confirmPassword, { target: { value: 'newpassword123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `${API_URL}/api/password-reset/verify`,
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              token: 'valid-token',
              newPassword: 'newpassword123',
            }),
          })
        );
      });
    });

    it('should show loading state during submission', async () => {
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(resolve, 1000);
          })
      );

      renderWithRouter('/reset-password/valid-token');

      await waitFor(() => {
        expect(screen.getByLabelText(/New Password/i)).toBeInTheDocument();
      });

      const newPassword = screen.getByLabelText(/New Password/i);
      const confirmPassword = screen.getByLabelText(/Confirm Password/i);
      const submitButton = screen.getByRole('button', { name: /Reset Password/i });

      fireEvent.change(newPassword, { target: { value: 'newpassword123' } });
      fireEvent.change(confirmPassword, { target: { value: 'newpassword123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Resetting Password/i })).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /Resetting Password/i })).toBeDisabled();
    });

    it('should redirect to login after successful reset', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Password reset successfully' }),
      });

      renderWithRouter('/reset-password/valid-token');

      await waitFor(() => {
        expect(screen.getByLabelText(/New Password/i)).toBeInTheDocument();
      });

      const newPassword = screen.getByLabelText(/New Password/i);
      const confirmPassword = screen.getByLabelText(/Confirm Password/i);
      const submitButton = screen.getByRole('button', { name: /Reset Password/i });

      fireEvent.change(newPassword, { target: { value: 'newpassword123' } });
      fireEvent.change(confirmPassword, { target: { value: 'newpassword123' } });

      // Use fake timers before triggering the success state
      vi.useFakeTimers();
      fireEvent.click(submitButton);

      // Need to flush pending promises before waiting
      await act(async () => {
        await Promise.resolve();
      });

      // Now we should see the success heading
      expect(screen.getByRole('heading', { name: /Password Reset/i })).toBeInTheDocument();

      // Advance timers to trigger the setTimeout callback
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(mockNavigate).toHaveBeenCalledWith('/login');

      vi.useRealTimers();
    });

    it('should handle API errors gracefully', async () => {
      vi.useRealTimers(); // Ensure real timers are active after previous test

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Token already used' }),
      });

      renderWithRouter('/reset-password/valid-token');

      await waitFor(() => {
        expect(screen.getByLabelText(/New Password/i)).toBeInTheDocument();
      });

      const newPassword = screen.getByLabelText(/New Password/i);
      const confirmPassword = screen.getByLabelText(/Confirm Password/i);
      const submitButton = screen.getByRole('button', { name: /Reset Password/i });

      fireEvent.change(newPassword, { target: { value: 'newpassword123' } });
      fireEvent.change(confirmPassword, { target: { value: 'newpassword123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Token already used/i)).toBeInTheDocument();
      });
    });
  });

  describe('UI Elements', () => {
    it('should render logo and title', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true, email: 'test@example.com' }),
      });

      renderWithRouter('/reset-password/valid-token');

      expect(screen.getByRole('heading', { name: /ConvoLab/i })).toBeInTheDocument();
    });

    it('should render back to login link', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true, email: 'test@example.com' }),
      });

      renderWithRouter('/reset-password/valid-token');

      const backLink = screen.getByRole('link', { name: /Back to Login/i });
      expect(backLink).toBeInTheDocument();
      expect(backLink).toHaveAttribute('href', '/login');
    });

    it('should show success icon after successful reset', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ valid: true, email: 'test@example.com' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: 'Password reset successfully' }),
        });

      renderWithRouter('/reset-password/valid-token');

      await waitFor(() => {
        expect(screen.getByLabelText(/New Password/i)).toBeInTheDocument();
      });

      const newPassword = screen.getByLabelText(/New Password/i);
      const confirmPassword = screen.getByLabelText(/Confirm Password/i);
      const submitButton = screen.getByRole('button', { name: /Reset Password/i });

      fireEvent.change(newPassword, { target: { value: 'newpassword123' } });
      fireEvent.change(confirmPassword, { target: { value: 'newpassword123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Password Reset/i })).toBeInTheDocument();
      });

      // Check that success icon (CheckCircle) is rendered
      // eslint-disable-next-line testing-library/no-node-access
      const successIcon = document.querySelector('.lucide-circle-check-big');
      expect(successIcon).toBeInTheDocument();
      expect(successIcon).toHaveClass('text-green-500');
    });

    it('should show error icon for invalid token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid token' }),
      });

      renderWithRouter('/reset-password/invalid-token');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Invalid Reset Link/i })).toBeInTheDocument();
      });

      // Check that error icon (XCircle) is rendered
      // eslint-disable-next-line testing-library/no-node-access
      const errorIcon = document.querySelector('.lucide-circle-x');
      expect(errorIcon).toBeInTheDocument();
      expect(errorIcon).toHaveClass('text-red-500');
    });
  });
});
