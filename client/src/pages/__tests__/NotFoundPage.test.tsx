/* eslint-disable testing-library/no-node-access */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import NotFoundPage from '../NotFoundPage';

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

describe('NotFoundPage', () => {
  const renderPage = () =>
    render(
      <BrowserRouter>
        <NotFoundPage />
      </BrowserRouter>
    );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render 404 code', () => {
      renderPage();
      expect(screen.getByText('404')).toBeInTheDocument();
    });

    it('should render Page Not Found heading', () => {
      renderPage();
      expect(screen.getByText('Page Not Found')).toBeInTheDocument();
    });

    it('should render error description', () => {
      renderPage();
      expect(
        screen.getByText(/Oops! The page you're looking for doesn't exist/)
      ).toBeInTheDocument();
    });

    it('should render ConvoLab text', () => {
      renderPage();
      expect(screen.getByText('ConvoLab')).toBeInTheDocument();
    });

    it('should render Logo', () => {
      renderPage();
      expect(screen.getByTestId('logo')).toBeInTheDocument();
    });
  });

  describe('helpful suggestions', () => {
    it('should render suggestions heading', () => {
      renderPage();
      expect(screen.getByText("Here's what you can do:")).toBeInTheDocument();
    });

    it('should suggest checking URL for typos', () => {
      renderPage();
      expect(screen.getByText('Check the URL for typos')).toBeInTheDocument();
    });

    it('should suggest returning to home page', () => {
      renderPage();
      expect(screen.getByText('Return to the home page and try again')).toBeInTheDocument();
    });

    it('should suggest using navigation menu', () => {
      renderPage();
      expect(
        screen.getByText("Use the navigation menu to find what you're looking for")
      ).toBeInTheDocument();
    });
  });

  describe('action buttons', () => {
    it('should render Go Back button', () => {
      renderPage();
      expect(screen.getByText('Go Back')).toBeInTheDocument();
    });

    it('should render Go to Library button', () => {
      renderPage();
      expect(screen.getByText('Go to Library')).toBeInTheDocument();
    });

    it('should navigate back when Go Back clicked', () => {
      renderPage();
      fireEvent.click(screen.getByText('Go Back'));
      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });

    it('should navigate to library when Go to Library clicked', () => {
      renderPage();
      fireEvent.click(screen.getByText('Go to Library'));
      expect(mockNavigate).toHaveBeenCalledWith('/app/library');
    });
  });

  describe('styling', () => {
    it('should have 404 text with large font', () => {
      renderPage();
      const text404 = screen.getByText('404');
      expect(text404).toHaveClass('text-9xl');
    });

    it('should center content', () => {
      const { container } = renderPage();
      const mainDiv = container.firstChild;
      expect(mainDiv).toHaveClass('flex', 'items-center', 'justify-center');
    });
  });
});
