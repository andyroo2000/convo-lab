/* eslint-disable testing-library/no-node-access, testing-library/no-container */
// Complex layout structure testing requires direct node access for navigation and content areas
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '../Layout';

const mockAuthState = vi.hoisted(() => ({
  user: {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    displayName: 'Test User',
    role: 'user',
    onboardingCompleted: true as boolean | undefined,
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

vi.mock('../../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: null,
    isLoading: false,
    error: null,
    isAdmin: false,
    isFeatureEnabled: () => true,
  }),
}));

// Mock child components
vi.mock('../UserMenu', () => ({
  default: ({
    mobileNavItems = [],
  }: {
    mobileNavItems?: Array<{ label: string; path: string; isActive: boolean }>;
  }) => (
    <div data-testid="user-menu">
      User Menu
      <div data-testid="user-menu-mobile-nav-items">
        {mobileNavItems.map((item) => (
          <span
            key={item.path}
            data-active={item.isActive ? 'true' : 'false'}
            data-path={item.path}
          >
            {item.label}
          </span>
        ))}
      </div>
    </div>
  ),
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
    onboardingCompleted: true as boolean | undefined,
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
            <Route path="app/study" element={<div data-testid="study-page">Study Page</div>} />
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

    it('should render desktop navigation tabs and no separate mobile tab row', () => {
      window.history.pushState({}, '', '/app/library');
      const { container } = renderLayout('/app/library');

      expect(container.querySelector('.hidden.sm\\:ml-6 a[href="/app/library"]')).toBeTruthy();
      expect(container.querySelector('.hidden.sm\\:ml-6 a[href="/app/create"]')).toBeTruthy();
      expect(container.querySelector('.hidden.sm\\:ml-6 a[href="/app/study"]')).toBeTruthy();
      expect(container.querySelector('.sm\\:hidden .retro-nav-tab')).toBeNull();
    });

    it('passes mobile primary navigation into the user menu', () => {
      window.history.pushState({}, '', '/app/study?viewAs=user-1');
      renderLayout('/app/study?viewAs=user-1');

      const mobileNav = screen.getByTestId('user-menu-mobile-nav-items');
      expect(mobileNav).toHaveTextContent('Library');
      expect(mobileNav).toHaveTextContent('Create');
      expect(mobileNav).toHaveTextContent('Study');
      expect(within(mobileNav).getByText('Study')).toHaveAttribute('data-active', 'true');
      expect(within(mobileNav).getByText('Library')).toHaveAttribute(
        'data-path',
        '/app/library?viewAs=user-1'
      );
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
    it('should not show onboarding modal when welcome surfaces are disabled', () => {
      mockAuthState.user = { ...baseMockUser, onboardingCompleted: false };
      window.history.pushState({}, '', '/app/library');
      renderLayout('/app/library');

      expect(screen.queryByText('Onboarding Modal')).not.toBeInTheDocument();
      expect(screen.getByTestId('library-page')).toBeInTheDocument();
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
