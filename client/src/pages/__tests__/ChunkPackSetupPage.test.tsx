import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ChunkPackSetupPage from '../ChunkPackSetupPage';

// Mock hooks
vi.mock('../../hooks/useLibraryData', () => ({
  useInvalidateLibrary: () => vi.fn(),
}));

vi.mock('../../hooks/useDemo', () => ({
  useIsDemo: () => false,
}));

// Mock fetch
global.fetch = vi.fn();

// Mock DemoRestrictionModal
vi.mock('../../components/common/DemoRestrictionModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="demo-modal">Demo Modal</div> : null,
}));

describe('ChunkPackSetupPage', () => {
  const renderPage = () =>
    render(
      <BrowserRouter>
        <ChunkPackSetupPage />
      </BrowserRouter>
    );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the page title', () => {
      renderPage();
      expect(screen.getByText('Lexical Chunk Packs')).toBeInTheDocument();
    });

    it('should render the description', () => {
      renderPage();
      expect(
        screen.getByText(/Learn high-frequency phrases through examples and exercises/)
      ).toBeInTheDocument();
    });

    it('should render the explanation section', () => {
      renderPage();
      expect(screen.getByText('What are Lexical Chunk Packs?')).toBeInTheDocument();
    });
  });

  describe('JLPT level selection', () => {
    it('should render all three JLPT levels', () => {
      renderPage();
      expect(screen.getByText('N5')).toBeInTheDocument();
      expect(screen.getByText('N4')).toBeInTheDocument();
      expect(screen.getByText('N3')).toBeInTheDocument();
    });

    it('should render level descriptions', () => {
      renderPage();
      expect(screen.getByText('Beginner')).toBeInTheDocument();
      expect(screen.getByText('Elementary')).toBeInTheDocument();
      expect(screen.getByText('Intermediate')).toBeInTheDocument();
    });

    it('should have N5 selected by default', () => {
      renderPage();
      const n5Button = screen.getByText('N5').closest('button');
      expect(n5Button).toHaveClass('border-yellow', 'bg-yellow');
    });

    it('should change level when clicking different button', () => {
      renderPage();
      const n4Button = screen.getByText('N4').closest('button');

      fireEvent.click(n4Button!);

      expect(n4Button).toHaveClass('border-yellow', 'bg-yellow');
    });
  });

  describe('theme selection', () => {
    it('should render themes for selected level', () => {
      renderPage();
      // N5 themes
      expect(screen.getByText('Daily Routine')).toBeInTheDocument();
      expect(screen.getByText('Greetings & Politeness')).toBeInTheDocument();
      expect(screen.getByText('Shopping')).toBeInTheDocument();
    });

    it('should show N4 themes when N4 is selected', () => {
      renderPage();
      const n4Button = screen.getByText('N4').closest('button');
      fireEvent.click(n4Button!);

      expect(screen.getByText('Health & Body')).toBeInTheDocument();
      expect(screen.getByText('Travel')).toBeInTheDocument();
      expect(screen.getByText('Opinions')).toBeInTheDocument();
    });

    it('should show N3 themes when N3 is selected', () => {
      renderPage();
      const n3Button = screen.getByText('N3').closest('button');
      fireEvent.click(n3Button!);

      expect(screen.getByText('Work & Professional')).toBeInTheDocument();
      expect(screen.getByText('Social Life')).toBeInTheDocument();
      expect(screen.getByText('Habits & Routines')).toBeInTheDocument();
    });

    it('should have first theme selected by default', () => {
      renderPage();
      const dailyRoutineButton = screen.getByText('Daily Routine').closest('button');
      expect(dailyRoutineButton).toHaveClass('border-yellow', 'bg-yellow');
    });

    it('should change theme when clicking different button', () => {
      renderPage();
      const shoppingButton = screen.getByText('Shopping').closest('button');

      fireEvent.click(shoppingButton!);

      expect(shoppingButton).toHaveClass('border-yellow', 'bg-yellow');
    });

    it('should reset to first theme when level changes', () => {
      renderPage();

      // Select a theme in N5
      const shoppingButton = screen.getByText('Shopping').closest('button');
      fireEvent.click(shoppingButton!);

      // Change to N4
      const n4Button = screen.getByText('N4').closest('button');
      fireEvent.click(n4Button!);

      // First N4 theme (Health & Body) should be selected
      const healthButton = screen.getByText('Health & Body').closest('button');
      expect(healthButton).toHaveClass('border-yellow', 'bg-yellow');
    });
  });

  describe('generate button', () => {
    it('should render the generate button', () => {
      renderPage();
      expect(screen.getByText('Generate Lexical Chunk Pack')).toBeInTheDocument();
    });

    it('should show BookOpen icon', () => {
      const { container } = renderPage();
      const button = screen.getByText('Generate Lexical Chunk Pack').closest('button');
      const svg = button?.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('info footer', () => {
    it('should display helpful tip', () => {
      renderPage();
      expect(
        screen.getByText(/Each pack contains 5-8 chunks with examples, a story, and exercises/)
      ).toBeInTheDocument();
    });
  });

  describe('responsive design', () => {
    it('should have responsive padding classes on buttons', () => {
      renderPage();
      const n5Button = screen.getByText('N5').closest('button');
      expect(n5Button).toHaveClass('px-4', 'sm:px-6', 'py-3', 'sm:py-4');
    });

    it('should have responsive grid for level selection', () => {
      const { container } = renderPage();
      const levelGrid = container.querySelector('.grid.grid-cols-2.sm\\:grid-cols-3');
      expect(levelGrid).toBeInTheDocument();
    });
  });

  describe('theme descriptions', () => {
    it('should show theme descriptions', () => {
      renderPage();
      expect(screen.getByText('Essential expressions for daily activities')).toBeInTheDocument();
      expect(screen.getByText('Common social expressions')).toBeInTheDocument();
    });
  });
});
