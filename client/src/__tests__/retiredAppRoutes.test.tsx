import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { Outlet } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

// Document-policy navigation is exercised against the static server in Playwright.
vi.mock('../features/journal/JournalDocumentBoundary', () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));

const auth = vi.hoisted(() => ({ signedOut: false, checking: false }));

vi.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({ user: null, loading: auth.checking, logout: vi.fn() }),
}));
vi.mock('../contexts/LocaleContext', () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('../contexts/AudioPreviewContext', () => ({
  AudioPreviewProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('../contexts/KnownKanjiContext', () => ({
  KnownKanjiProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('../components/common/Layout', async (importOriginal) => {
  const { default: Layout } = await importOriginal<typeof import('../components/common/Layout')>();
  return { default: () => (auth.signedOut ? <Layout /> : <Outlet />) };
});
vi.mock('../hooks/useEffectiveUser', () => ({
  default: () => ({ effectiveUser: null, isImpersonating: false }),
}));
vi.mock('../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ isFeatureEnabled: () => false }),
}));
vi.mock('../hooks/useDemo', () => ({ useIsDemo: () => false }));
vi.mock('../features/readings/useReadings', () => ({ default: () => ({ data: [] }) }));
vi.mock('../pages/LandingPage', () => ({ default: () => <h1>Journal landing</h1> }));
vi.mock('../pages/LoginPage', () => ({ default: () => <h1>Sign in</h1> }));
vi.mock('../components/study/StudyFeatureBoundary', () => ({ default: () => <Outlet /> }));
vi.mock('../pages/ToolsPage', () => ({ default: () => <h1>Public tools</h1> }));
vi.mock('../components/common/ToolsPublicLayout', () => ({ default: () => <Outlet /> }));
vi.mock('../pages/StudyPage', () => ({ default: () => <h1>Study home</h1> }));
vi.mock('../pages/JournalPage', () => ({ default: () => <h1>Journal home</h1> }));

describe('App route retirement', () => {
  beforeEach(() => {
    auth.signedOut = false;
    auth.checking = false;
    window.history.replaceState(null, '', '/');
  });

  it.each([
    '/app/library',
    '/app/create',
    '/app/create/dialogue',
    '/app/create/script',
    '/app/create/audio-course/episode-1',
  ])('shows not found for retired route %s', async (path) => {
    window.history.replaceState(null, '', path);
    render(<App />);
    expect(await screen.findByRole('heading', { name: /404.*Page Not Found/ })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to Journal' })).toBeVisible();
  });

  it.each(['/app'])('opens Journal from %s', async (path) => {
    window.history.replaceState(null, '', path);
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Journal home' })).toBeVisible();
    await waitFor(() => expect(window.location.pathname).toBe('/app/journal'));
  });

  it('keeps signed-out home visitors on the public landing page', async () => {
    auth.signedOut = true;
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Journal landing' })).toBeVisible();
    expect(window.location.pathname).toBe('/');
  });

  it.each([
    '/app',
    '/app/journal/missing-entry',
    '/app/journal/missing/extra?draft=1#correction',
    '/app/unknown',
    '/app/library',
    '/app/admin/users',
    '/app/settings',
  ])('requires sign-in before resolving private route %s', async (path) => {
    auth.signedOut = true;
    window.history.replaceState(null, '', path);
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(window.location.pathname).toBe('/login');
    expect(new URLSearchParams(window.location.search).get('returnUrl')).toBe(path);
  });

  it('does not show a private 404 while the session is still being checked', async () => {
    auth.signedOut = true;
    auth.checking = true;
    window.history.replaceState(null, '', '/app/journal/missing/extra');
    const view = render(<App />);
    expect(await screen.findByText('Loading...')).toBeVisible();
    expect(screen.queryByText(/Page Not Found/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
    auth.checking = false;
    view.rerender(<App />);
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  it('keeps unknown public URLs public', async () => {
    auth.signedOut = true;
    window.history.replaceState(null, '', '/unknown-public-page');
    render(<App />);
    expect(await screen.findByRole('heading', { name: /404.*Page Not Found/ })).toBeVisible();
    expect(window.location.pathname).toBe('/unknown-public-page');
  });

  it('keeps a direct tools visit public', async () => {
    window.history.replaceState(null, '', '/tools');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Public tools' })).toBeVisible();
    expect(window.location.pathname).toBe('/tools');
  });
});
