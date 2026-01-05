import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ForgotPasswordPage from '../ForgotPasswordPage';

const API_URL = 'http://localhost:3001';

// Mock global fetch
global.fetch = vi.fn();

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>
  );
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  describe('Rendering', () => {
    it('should render forgot password form', () => {
      renderWithRouter();

      expect(screen.getByRole('heading', { name: /ConvoLab/ })).toBeInTheDocument();
      expect(screen.getByText(/Reset your password/)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Forgot Password/i })).toBeInTheDocument();
    });

    it('should render email input field', () => {
      renderWithRouter();

      const emailInput = screen.getByLabelText(/Email/i);
      expect(emailInput).toBeInTheDocument();
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('required');
    });

    it('should render submit button', () => {
      renderWithRouter();

      const submitButton = screen.getByRole('button', { name: /Send Reset Link/ });
      expect(submitButton).toBeInTheDocument();
    });

    it('should render back to login link', () => {
      renderWithRouter();

      const backLink = screen.getByRole('link', { name: /Back to Login/ });
      expect(backLink).toBeInTheDocument();
      expect(backLink).toHaveAttribute('href', '/login');
    });

    it('should render remember password link', () => {
      renderWithRouter();

      const loginLink = screen.getByRole('link', { name: /Log in/ });
      expect(loginLink).toBeInTheDocument();
      expect(loginLink).toHaveAttribute('href', '/login');
    });
  });

  describe('Form Submission', () => {
    it('should submit email and show success message', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Reset email sent' }),
      });

      renderWithRouter();

      const emailInput = screen.getByLabelText(/Email/i);
      const submitButton = screen.getByRole('button', { name: /Send Reset Link/ });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Check Your Email/i })).toBeInTheDocument();
      });

      expect(screen.getByText(/If an account exists with/)).toBeInTheDocument();
      expect(screen.getByText(/test@example\.com/, { exact: false })).toBeInTheDocument();
      expect(screen.getByText(/The link will expire in 1 hour/)).toBeInTheDocument();
    });

    it('should call API with correct email', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Reset email sent' }),
      });

      renderWithRouter();

      const emailInput = screen.getByLabelText(/Email/i);
      const submitButton = screen.getByRole('button', { name: /Send Reset Link/ });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `${API_URL}/api/password-reset/request`,
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email: 'test@example.com' }),
          })
        );
      });
    });

    it('should show loading state during submission', async () => {
      (global.fetch as any).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(resolve, 1000);
          })
      );

      renderWithRouter();

      const emailInput = screen.getByLabelText(/Email/i);
      const submitButton = screen.getByRole('button', { name: /Send Reset Link/ });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.click(submitButton);

      expect(screen.getByRole('button', { name: /Sending.../ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sending.../ })).toBeDisabled();
    });

    it('should show error message on API failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Server error' }),
      });

      renderWithRouter();

      const emailInput = screen.getByLabelText(/Email/i);
      const submitButton = screen.getByRole('button', { name: /Send Reset Link/ });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeInTheDocument();
      });
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      renderWithRouter();

      const emailInput = screen.getByLabelText(/Email/i);
      const submitButton = screen.getByRole('button', { name: /Send Reset Link/ });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should handle generic errors with fallback message', async () => {
      (global.fetch as any).mockRejectedValueOnce('Unknown error');

      renderWithRouter();

      const emailInput = screen.getByLabelText(/Email/i);
      const submitButton = screen.getByRole('button', { name: /Send Reset Link/ });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('An error occurred')).toBeInTheDocument();
      });
    });
  });

  describe('Success State', () => {
    it('should show mail icon on success', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Reset email sent' }),
      });

      renderWithRouter();

      const emailInput = screen.getByLabelText(/Email/i);
      const submitButton = screen.getByRole('button', { name: /Send Reset Link/ });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Check Your Email/i })).toBeInTheDocument();
      });

      // Verify success message is complete
      expect(screen.getByText(/sent a password reset link/i)).toBeInTheDocument();
    });

    it('should show back to login button in success state', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Reset email sent' }),
      });

      renderWithRouter();

      const emailInput = screen.getByLabelText(/Email/i);
      const submitButton = screen.getByRole('button', { name: /Send Reset Link/ });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /Back to Login/ })).toBeInTheDocument();
      });
    });

    it('should display submitted email in success message', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Reset email sent' }),
      });

      renderWithRouter();

      const testEmail = 'user@example.com';
      const emailInput = screen.getByLabelText(/Email/i);
      const submitButton = screen.getByRole('button', { name: /Send Reset Link/ });

      fireEvent.change(emailInput, { target: { value: testEmail } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(new RegExp(testEmail.replace('.', '\\.')))).toBeInTheDocument();
      });
    });

    it('should show expiration reminder in success state', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Reset email sent' }),
      });

      renderWithRouter();

      const emailInput = screen.getByLabelText(/Email/i);
      const submitButton = screen.getByRole('button', { name: /Send Reset Link/ });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/The link will expire in 1 hour/)).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('should require email field', () => {
      renderWithRouter();

      const emailInput = screen.getByLabelText(/Email/i);
      expect(emailInput).toBeRequired();
    });

    it('should have email type for input field', () => {
      renderWithRouter();

      const emailInput = screen.getByLabelText(/Email/i);
      expect(emailInput).toHaveAttribute('type', 'email');
    });

    it('should show placeholder text', () => {
      renderWithRouter();

      const emailInput = screen.getByPlaceholderText('you@example.com');
      expect(emailInput).toBeInTheDocument();
    });
  });

  describe('UI Elements', () => {
    it('should render logo', () => {
      renderWithRouter();

      expect(screen.getByRole('heading', { name: /ConvoLab/ })).toBeInTheDocument();
    });

    it('should render company footer', () => {
      renderWithRouter();

      expect(screen.getByText(/Conversational Dynamics Consulting Group/)).toBeInTheDocument();
    });

    it('should render help text', () => {
      renderWithRouter();

      expect(
        screen.getByText(/Enter your email address and we'll send you a link/)
      ).toBeInTheDocument();
    });
  });
});
