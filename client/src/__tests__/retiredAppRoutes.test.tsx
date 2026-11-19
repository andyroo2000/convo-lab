import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { Outlet } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

vi.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
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
vi.mock('../components/common/Layout', () => ({ default: () => <Outlet /> }));
vi.mock('../components/common/PWAInstallPrompt', () => ({ default: () => null }));
vi.mock('../components/study/StudyFeatureBoundary', () => ({ default: () => <Outlet /> }));
vi.mock('../pages/ToolsPage', () => ({ default: () => <h1>Public tools</h1> }));
vi.mock('../components/common/ToolsPublicLayout', () => ({ default: () => <Outlet /> }));
vi.mock('../pages/StudyPage', () => ({ default: () => <h1>Study home</h1> }));
vi.mock('../pages/JournalPage', () => ({ default: () => <h1>Journal home</h1> }));

describe('App route retirement', () => {
  beforeEach(() => {
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
    expect(screen.getByRole('link', { name: 'Go to Study' })).toBeVisible();
  });

  it.each(['/', '/app'])('opens Journal from %s', async (path) => {
    window.history.replaceState(null, '', path);
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Journal home' })).toBeVisible();
    await waitFor(() => expect(window.location.pathname).toBe('/app/journal'));
  });
  it('keeps a direct tools visit public', async () => {
    window.history.replaceState(null, '', '/tools');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Public tools' })).toBeVisible();
    expect(window.location.pathname).toBe('/tools');
  });
});
