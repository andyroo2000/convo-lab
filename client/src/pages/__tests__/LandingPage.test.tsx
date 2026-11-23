import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from '../LandingPage';

const mockUser = vi.fn(() => null as { id: string } | null);
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser() }) }));
vi.mock('../../features/landing/landingScroll', () => ({
  startLandingStory: () => () => undefined,
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>
  );
const completeRequest = () => {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'learner@example.com' } });
  fireEvent.click(screen.getByLabelText('Web'));
  fireEvent.click(screen.getByLabelText('Android'));
  fireEvent.change(screen.getByLabelText(/Why would you like to try it/), {
    target: { value: 'A paragraph a day.' },
  });
  fireEvent.submit(screen.getByRole('form', { name: 'Request beta access' }));
};

describe('Journal landing page', () => {
  beforeEach(() => {
    mockUser.mockReturnValue(null);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('offers login and beta access without redirecting guests', () => {
    renderPage();
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'I tried journaling to improve my Japanese.'
    );
    expect(screen.getAllByRole('link', { name: 'Request access' })).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Just checking!' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Love WaniKani? We do too.' })).toBeInTheDocument();
  });

  it('keeps the landing page available with an Open Journal link when signed in', () => {
    mockUser.mockReturnValue({ id: 'user-1' });
    renderPage();
    expect(screen.getByRole('link', { name: 'Open Journal' })).toHaveAttribute(
      'href',
      '/app/journal'
    );
    expect(screen.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('sends the selected platforms and optional message and confirms success', async () => {
    const request = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', request);
    renderPage();
    completeRequest();
    expect(await screen.findByRole('status')).toHaveTextContent('We’ll email you about access');
    expect(request).toHaveBeenCalledWith(
      '/api/convolab/browser/auth/beta-requests',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          email: 'learner@example.com',
          devices: ['Web', 'Android'],
          message: 'A paragraph a day.',
        }),
      })
    );
  });

  it('requires a platform before sending', () => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    renderPage();
    fireEvent.submit(screen.getByRole('form', { name: 'Request beta access' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose at least one platform.');
    expect(request).not.toHaveBeenCalled();
  });

  it('retains the form after a failed delivery and supports retry', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', request);
    renderPage();
    completeRequest();
    expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable');
    expect(screen.getByLabelText('Email')).toHaveValue('learner@example.com');
    fireEvent.submit(screen.getByRole('form', { name: 'Request beta access' }));
    expect(await screen.findByRole('status')).toBeInTheDocument();
  });

  it('shows rate limits without claiming the email was sent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    renderPage();
    completeRequest();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Too many requests'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
