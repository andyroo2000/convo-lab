import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LandingPage from '../LandingPage';

// Mock Logo component
vi.mock('../../components/common/Logo', () => ({
  default: () => <div data-testid="logo">Logo</div>,
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
const mockUser = vi.fn(() => null);
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
    it('should render ConvoLab title', () => {
      renderPage();
      // Multiple ConvoLab texts exist (header and footer)
      expect(screen.getAllByText('ConvoLab').length).toBeGreaterThan(0);
    });

    it('should render Logo', () => {
      renderPage();
      expect(screen.getAllByTestId('logo').length).toBeGreaterThan(0);
    });
  });

  describe('unauthenticated user', () => {
    it('should render Sign In button', () => {
      renderPage();
      expect(screen.getByTestId('landing-header-button-signin')).toBeInTheDocument();
    });

    it('should render Get Started button in header', () => {
      renderPage();
      expect(screen.getByTestId('landing-header-button-get-started')).toBeInTheDocument();
    });

    it('should render Start Learning Free button in hero', () => {
      renderPage();
      expect(screen.getByTestId('landing-hero-button-start')).toBeInTheDocument();
    });

    it('should navigate to login when Sign In clicked', () => {
      renderPage();
      fireEvent.click(screen.getByTestId('landing-header-button-signin'));
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    it('should navigate to login when Get Started clicked', () => {
      renderPage();
      fireEvent.click(screen.getByTestId('landing-header-button-get-started'));
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    it('should navigate to login when hero CTA clicked', () => {
      renderPage();
      fireEvent.click(screen.getByTestId('landing-hero-button-start'));
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  describe('authenticated user', () => {
    beforeEach(() => {
      mockUser.mockReturnValue({ id: 'user-1', email: 'test@test.com' });
    });

    it('should render Go to App button in header', () => {
      renderPage();
      expect(screen.getByTestId('landing-header-button-go-to-app')).toBeInTheDocument();
    });

    it('should render Go to App button in hero', () => {
      renderPage();
      expect(screen.getByTestId('landing-hero-button-go-to-app')).toBeInTheDocument();
    });

    it('should not render Sign In button', () => {
      renderPage();
      expect(screen.queryByTestId('landing-header-button-signin')).not.toBeInTheDocument();
    });

    it('should navigate to library when Go to App clicked', () => {
      renderPage();
      fireEvent.click(screen.getByTestId('landing-header-button-go-to-app'));
      expect(mockNavigate).toHaveBeenCalledWith('/app/library');
    });
  });

  describe('hero section', () => {
    it('should render Research-Backed Language Lab badge', () => {
      renderPage();
      expect(screen.getByText('Research-Backed Language Lab')).toBeInTheDocument();
    });

    it('should render main headline', () => {
      renderPage();
      expect(screen.getByText('Your Personal')).toBeInTheDocument();
      expect(screen.getByText('AI Language Lab')).toBeInTheDocument();
    });

    it('should render description', () => {
      renderPage();
      expect(
        screen.getByText(/Create custom content grounded in linguistics and SLA research/)
      ).toBeInTheDocument();
    });
  });

  describe('features section', () => {
    it('should render Your Personal Language Lab heading', () => {
      renderPage();
      // Multiple elements contain these texts
      expect(screen.getAllByText(/Your Personal/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Language Lab/).length).toBeGreaterThan(0);
    });

    it('should render Comprehensible Input feature', () => {
      renderPage();
      expect(screen.getByText('Comprehensible Input')).toBeInTheDocument();
    });

    it('should render Narrow Listening feature', () => {
      renderPage();
      expect(screen.getByText('Narrow Listening')).toBeInTheDocument();
    });

    it('should render Processing Instruction feature', () => {
      renderPage();
      expect(screen.getByText('Processing Instruction & Chunks')).toBeInTheDocument();
    });

    it('should render feature descriptions', () => {
      renderPage();
      expect(
        screen.getByText(/Generate AI dialogues calibrated to your proficiency level/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Build fluency through repetition with variation/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Acquire grammar through structured input activities/)
      ).toBeInTheDocument();
    });
  });

  describe('CTA section', () => {
    it('should render Ready to Build heading', () => {
      renderPage();
      expect(screen.getByText(/Ready to Build/)).toBeInTheDocument();
    });

    it('should render CTA description', () => {
      renderPage();
      expect(
        screen.getByText(/Start creating research-backed, personalized content/)
      ).toBeInTheDocument();
    });

    it('should render CTA button for unauthenticated user', () => {
      renderPage();
      expect(screen.getByTestId('landing-cta-button-start')).toBeInTheDocument();
    });

    it('should render CTA button for authenticated user', () => {
      mockUser.mockReturnValue({ id: 'user-1' });
      renderPage();
      expect(screen.getByTestId('landing-cta-button-go-to-app')).toBeInTheDocument();
    });
  });

  describe('footer', () => {
    it('should render footer with ConvoLab text', () => {
      renderPage();
      const footerText = screen.getAllByText('ConvoLab');
      expect(footerText.length).toBeGreaterThan(0);
    });

    it('should render tagline', () => {
      renderPage();
      expect(screen.getByText('Your personal AI language lab')).toBeInTheDocument();
    });
  });
});
