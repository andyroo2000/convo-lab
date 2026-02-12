/* eslint-disable testing-library/no-node-access, testing-library/no-container */
// Complex layout structure testing requires direct node access for navigation and content areas
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '../Layout';

const mockAuthState = vi.hoisted(() => ({
  user: {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    displayName: 'Test User',
    role: 'user',
    onboardingCompleted: true,
    avatarColor: '#000000',
  },
  loading: false,
}));

// Mock the auth context
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockAuthState.user,
    loading: mockAuthState.loading,
    logout: vi.fn(),
  }),
}));

// Mock the demo hook
vi.mock('../../../hooks/useDemo', () => ({
  useIsDemo: () => false,
}));

// Mock child components
vi.mock('../UserMenu', () => ({
  default: () => <div data-testid="user-menu">User Menu</div>,
}));

vi.mock('../Logo', () => ({
  default: () => <div data-testid="logo">Logo</div>,
}));

vi.mock('../../onboarding/OnboardingModal', () => ({
  default: () => <div>Onboarding Modal</div>,
}));

describe('Layout', () => {
  const baseMockUser = {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    displayName: 'Test User',
    role: 'user' as const,
    onboardingCompleted: true,
    avatarColor: '#000000',
  };

  const renderLayout = (_initialPath: string) =>
    render(
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<Layout />}>
            <Route
              path="app/library"
              element={<div data-testid="library-page">Library Page</div>}
            />
            <Route path="app/create" element={<div data-testid="create-page">Create Page</div>} />
            <Route path="app/other" element={<div data-testid="other-page">Other Page</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    );

  beforeEach(() => {
    mockAuthState.user = { ...baseMockUser };
    mockAuthState.loading = false;
  });

  describe('Full-width mobile pages', () => {
    it('should remove horizontal padding on mobile for library page', () => {
      window.history.pushState({}, '', '/app/library');
      const { container } = renderLayout('/app/library');

      const main = container.querySelector('main');
      expect(main).toHaveClass('sm:px-6');
      expect(main).not.toHaveClass('px-4');
    });

    it('should remove horizontal padding on mobile for create page', () => {
      window.history.pushState({}, '', '/app/create');
      const { container } = renderLayout('/app/create');

      const main = container.querySelector('main');
      expect(main).toHaveClass('sm:px-6');
      expect(main).not.toHaveClass('px-4');
    });

    it('should keep horizontal padding on mobile for other pages', () => {
      window.history.pushState({}, '', '/app/other');
      const { container } = renderLayout('/app/other');

      const main = container.querySelector('main');
      expect(main).toHaveClass('px-4');
      expect(main).toHaveClass('sm:px-6');
    });
  });

  describe('Navigation', () => {
    it('should render library and create navigation links', () => {
      window.history.pushState({}, '', '/app/library');
      renderLayout('/app/library');

      const libraryLinks = screen.getAllByText('Library');
      const createLinks = screen.getAllByText('Create');

      expect(libraryLinks.length).toBeGreaterThan(0);
      expect(createLinks.length).toBeGreaterThan(0);
    });

    it('should highlight active library navigation', () => {
      window.history.pushState({}, '', '/app/library');
      const { container } = renderLayout('/app/library');

      // Desktop navigation
      const desktopLibraryLink = container.querySelector(
        '.hidden.sm\\:ml-6 a[href="/app/library"]'
      );
      expect(desktopLibraryLink).toHaveClass('bg-white', 'text-strawberry');
    });

    it('should highlight active create navigation', () => {
      window.history.pushState({}, '', '/app/create');
      const { container } = renderLayout('/app/create');

      // Desktop navigation
      const desktopCreateLink = container.querySelector('.hidden.sm\\:ml-6 a[href="/app/create"]');
      expect(desktopCreateLink).toHaveClass('bg-white', 'text-coral');
    });

    it('should not highlight library when on playback route', () => {
      window.history.pushState({}, '', '/app/playback/episode-123');
      const { container } = renderLayout('/app/playback/episode-123');

      const desktopLibraryLink = container.querySelector(
        '.hidden.sm\\:ml-6 a[href="/app/library"]'
      );
      expect(desktopLibraryLink).not.toHaveClass('bg-white', 'text-strawberry');
    });
  });

  describe('Layout structure', () => {
    it('should render navigation bar', () => {
      window.history.pushState({}, '', '/app/library');
      const { container } = renderLayout('/app/library');

      const nav = container.querySelector('nav');
      expect(nav).toBeTruthy();
      expect(nav).toHaveClass('bg-periwinkle');
    });

    it('should render main content area', () => {
      window.history.pushState({}, '', '/app/library');
      const { container } = renderLayout('/app/library');

      const main = container.querySelector('main');
      expect(main).toBeTruthy();
      expect(main).toHaveClass('max-w-7xl', 'mx-auto', 'py-8');
    });

    it('should render user menu', () => {
      window.history.pushState({}, '', '/app/library');
      renderLayout('/app/library');

      expect(screen.getByTestId('user-menu')).toBeTruthy();
    });

    it('should render logo', () => {
      window.history.pushState({}, '', '/app/library');
      renderLayout('/app/library');

      expect(screen.getByTestId('logo')).toBeTruthy();
    });
  });

  describe('Onboarding behavior', () => {
    it('should show onboarding modal only when onboardingCompleted is explicitly false', () => {
      mockAuthState.user = { ...baseMockUser, onboardingCompleted: false };
      window.history.pushState({}, '', '/app/library');
      renderLayout('/app/library');

      expect(screen.getByText('Onboarding Modal')).toBeInTheDocument();
      expect(screen.queryByTestId('library-page')).not.toBeInTheDocument();
    });

    it('should not block the app when onboardingCompleted is undefined', () => {
      mockAuthState.user = { ...baseMockUser, onboardingCompleted: undefined };
      window.history.pushState({}, '', '/app/library');
      renderLayout('/app/library');

      expect(screen.queryByText('Onboarding Modal')).not.toBeInTheDocument();
      expect(screen.getByTestId('library-page')).toBeInTheDocument();
    });
  });
});
