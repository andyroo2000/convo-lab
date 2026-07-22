import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ResetPasswordPage from '../ResetPasswordPage';

const API_URL = 'http://localhost:3001';
const resetLink = '/reset-password?token=broker-token&email=target%40example.com';
const mockNavigate = vi.fn();
const mockFetch = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.stubGlobal('fetch', mockFetch);

function renderPage(initialRoute = resetLink) {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function fillValidPassword() {
  fireEvent.change(screen.getByLabelText(/New Password/i), {
    target: { value: 'newpassword123' },
  });
  fireEvent.change(screen.getByLabelText(/Confirm Password/i), {
    target: { value: 'newpassword123' },
  });
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('accepts a Learning OS reset link without a token preflight request', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /Reset Password/i })).toBeInTheDocument();
    expect(screen.getByText(/target@example\.com/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/New Password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm Password/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['token and email', '/reset-password'],
    ['email', '/reset-password?token=broker-token'],
    ['token', '/reset-password?email=target%40example.com'],
  ])('rejects a reset link missing %s', (_missing, route) => {
    renderPage(route);

    expect(screen.getByRole('heading', { name: /Invalid Reset Link/i })).toBeInTheDocument();
    expect(screen.getByText('Invalid reset link')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Request New Link/i })).toHaveAttribute(
      'href',
      '/forgot-password'
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('validates matching and minimum-length passwords before submission', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(/New Password/i), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), {
      target: { value: 'different123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Reset Password/i }));

    expect(await screen.findByText(/Passwords do not match/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/New Password/i), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: /Reset Password/i }));

    expect(await screen.findByText(/Password must be at least 8 characters/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('submits the canonical token, email, and password payload', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Password reset successfully' }),
    });
    renderPage();
    fillValidPassword();

    fireEvent.click(screen.getByRole('button', { name: /Reset Password/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(`${API_URL}/api/password-reset/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: 'target@example.com',
          token: 'broker-token',
          newPassword: 'newpassword123',
        }),
      });
    });
    expect(screen.getByRole('heading', { name: /Password Reset/i })).toBeInTheDocument();
  });

  it('disables submission while the reset request is pending', async () => {
    let resolveRequest!: (value: { ok: boolean; json: () => Promise<object> }) => void;
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );
    renderPage();
    fillValidPassword();

    fireEvent.click(screen.getByRole('button', { name: /Reset Password/i }));

    const pendingButton = await screen.findByRole('button', { name: /Resetting/i });
    expect(pendingButton).toBeDisabled();

    resolveRequest({
      ok: true,
      json: async () => ({ message: 'Password reset successfully' }),
    });
    await screen.findByRole('heading', { name: /Password Reset/i });
  });

  it.each([
    [{ error: { message: 'Broker token expired' } }, 'Broker token expired'],
    [{ message: 'Password rejected' }, 'Password rejected'],
  ])('surfaces API error envelopes', async (body, expectedMessage) => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => body,
    });
    renderPage();
    fillValidPassword();

    fireEvent.click(screen.getByRole('button', { name: /Reset Password/i }));

    expect(await screen.findByText(expectedMessage)).toBeInTheDocument();
  });

  it('redirects to login after a successful reset', async () => {
    vi.useFakeTimers();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Password reset successfully' }),
    });
    renderPage();
    fillValidPassword();

    fireEvent.click(screen.getByRole('button', { name: /Reset Password/i }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole('heading', { name: /Password Reset/i })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('keeps the ConvoLab identity and login navigation visible', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /ConvoLab/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Login/i })).toHaveAttribute('href', '/login');
  });
});
