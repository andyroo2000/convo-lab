import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import LoginPage from '../LoginPage';

const auth = vi.hoisted(() => ({
  user: null as null | { id: string },
  loading: false,
  login: vi.fn(),
  signup: vi.fn(),
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => auth }));

const Destination = () => {
  const location = useLocation();
  return (
    <p>
      Destination: {location.pathname}
      {location.search}
      {location.hash}
    </p>
  );
};
function renderLogin(returnUrl = '/app/journal/01abc?draft=1#correction') {
  return render(
    <MemoryRouter initialEntries={[`/login?${new URLSearchParams({ returnUrl })}`]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('login routing', () => {
  beforeEach(() => {
    auth.user = null;
    auth.loading = false;
    auth.login.mockReset().mockResolvedValue(undefined);
  });

  it('waits for the session check before showing the sign-in form', () => {
    auth.loading = true;
    renderLogin();
    expect(screen.getByRole('status')).toBeVisible();
    expect(screen.queryByTestId('auth-input-password')).not.toBeInTheDocument();
  });

  it('resumes a safe private destination for an already signed-in visitor', async () => {
    auth.user = { id: 'reader' };
    renderLogin();
    expect(
      await screen.findByText('Destination: /app/journal/01abc?draft=1#correction')
    ).toBeVisible();
  });

  it('does not send an authenticated visitor to an external or auth URL', async () => {
    auth.user = { id: 'reader' };
    renderLogin('//evil.example');
    expect(await screen.findByText('Destination: /app/journal')).toBeVisible();
  });

  it('validates the return URL for password login and the Google link', async () => {
    renderLogin('https://evil.example');
    expect(screen.getByTestId('auth-google-link')).toHaveAttribute(
      'href',
      '/api/convolab/browser/auth/google?returnUrl=%2Fapp%2Fjournal'
    );
    fireEvent.change(screen.getByTestId('auth-input-email'), {
      target: { value: 'reader@example.test' },
    });
    fireEvent.change(screen.getByTestId('auth-input-password'), { target: { value: 'password' } });
    fireEvent.click(screen.getByTestId('auth-submit-button'));
    await waitFor(() => expect(screen.getByText('Destination: /app/journal')).toBeVisible());
  });

  it('carries the intended entry to the Google OAuth start endpoint', () => {
    renderLogin();
    expect(screen.getByTestId('auth-google-link')).toHaveAttribute(
      'href',
      '/api/convolab/browser/auth/google?returnUrl=%2Fapp%2Fjournal%2F01abc%3Fdraft%3D1%23correction'
    );
  });
});
