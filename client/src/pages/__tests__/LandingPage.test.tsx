import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LandingPage from '../LandingPage';

// Mock Logo component
vi.mock('../../components/common/Logo', () => ({
  default: () => (
    <div data-testid="logo">
      <span>ConvoLab</span>
    </div>
  ),
}));

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
const mockUser = vi.fn(() => null as { id: string; email?: string } | null);
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser() }),
}));

describe('LandingPage', () => {
  const renderPage = () =>
    render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    );

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.mockReturnValue(null);
  });

  describe('header', () => {
    it('renders logo and tools-first CTA', () => {
      renderPage();
      expect(screen.getByTestId('logo')).toBeInTheDocument();
      expect(screen.getByTestId('landing-header-button-open-tools')).toBeInTheDocument();
    });

    it('navigates to tools when header tools button clicked', () => {
      renderPage();
      fireEvent.click(screen.getByTestId('landing-header-button-open-tools'));
      expect(mockNavigate).toHaveBeenCalledWith('/tools');
    });
  });

  describe('unauthenticated user', () => {
    it('shows private beta badge and no app CTA', () => {
      renderPage();
      expect(screen.getByTestId('landing-header-beta-badge')).toBeInTheDocument();
      expect(screen.queryByTestId('landing-header-button-go-to-app')).not.toBeInTheDocument();
    });
  });

  describe('authenticated user', () => {
    beforeEach(() => {
      mockUser.mockReturnValue({ id: 'user-1', email: 'test@test.com' });
    });

    it('shows go-to-app CTA in header', () => {
      renderPage();
      expect(screen.getByTestId('landing-header-button-go-to-app')).toBeInTheDocument();
    });

    it('navigates to app library when go-to-app clicked', () => {
      renderPage();
      fireEvent.click(screen.getByTestId('landing-header-button-go-to-app'));
      expect(mockNavigate).toHaveBeenCalledWith('/app/library');
    });
  });

  describe('hero and sections', () => {
    it('renders tools-focused headline and beta messaging', () => {
      renderPage();
      expect(screen.getByText('Practice Japanese')).toBeInTheDocument();
      expect(screen.getByText('Dates & Time')).toBeInTheDocument();
      expect(screen.getByText(/private beta and invite-only/i)).toBeInTheDocument();
    });

    it('renders tool cards and cta copy', () => {
      renderPage();
      expect(screen.getByText('Japanese Date Practice Tool')).toBeInTheDocument();
      expect(screen.getByText('Japanese Time Practice Tool')).toBeInTheDocument();
      expect(screen.getByText(/ConvoLab App: Private Beta/)).toBeInTheDocument();
      expect(screen.getByText('Start With Free Japanese Tools')).toBeInTheDocument();
    });
  });

  describe('hero actions', () => {
    it('navigates to date tool', () => {
      renderPage();
      fireEvent.click(screen.getByTestId('landing-hero-button-open-date-tool'));
      expect(mockNavigate).toHaveBeenCalledWith('/tools/japanese-date');
    });

    it('navigates to time tool', () => {
      renderPage();
      fireEvent.click(screen.getByTestId('landing-hero-button-open-time-tool'));
      expect(mockNavigate).toHaveBeenCalledWith('/tools/japanese-time');
    });
  });

  describe('cta section', () => {
    it('navigates to tools directory from final cta', () => {
      renderPage();
      fireEvent.click(screen.getByTestId('landing-cta-button-open-tools'));
      expect(mockNavigate).toHaveBeenCalledWith('/tools');
    });
  });
});
