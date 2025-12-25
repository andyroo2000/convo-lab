import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import NarrowListeningCreatorPage from '../NarrowListeningCreatorPage';

// Mock hooks
vi.mock('../../hooks/useLibraryData', () => ({
  useInvalidateLibrary: () => vi.fn(),
}));

vi.mock('../../hooks/useDemo', () => ({
  useIsDemo: () => false,
}));

// Mock DemoRestrictionModal
vi.mock('../../components/common/DemoRestrictionModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="demo-modal">Demo Modal</div> : null,
}));

// Mock fetch
global.fetch = vi.fn();

describe('NarrowListeningCreatorPage', () => {
  const renderPage = () => render(
      <BrowserRouter>
        <NarrowListeningCreatorPage />
      </BrowserRouter>
    );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the page title', () => {
      renderPage();
      expect(screen.getByText('Narrow Listening Packs')).toBeInTheDocument();
    });

    it('should render the subtitle', () => {
      renderPage();
      expect(
        screen.getByText('The same story told 5 different ways for focused listening practice')
      ).toBeInTheDocument();
    });

    it('should render Your Story section header', () => {
      renderPage();
      expect(screen.getByText('Your Story')).toBeInTheDocument();
    });

    it('should render What is Narrow Listening explanation', () => {
      renderPage();
      expect(screen.getByText('What is Narrow Listening?')).toBeInTheDocument();
    });
  });

  describe('language selection', () => {
    it('should render all three language options', () => {
      renderPage();
      expect(screen.getByText('Japanese')).toBeInTheDocument();
      expect(screen.getByText('Chinese')).toBeInTheDocument();
      expect(screen.getByText('Spanish')).toBeInTheDocument();
    });

    it('should have Japanese selected by default', () => {
      renderPage();
      const japaneseButton = screen.getByText('Japanese').closest('button');
      expect(japaneseButton).toHaveClass('bg-strawberry', 'text-white');
    });

    it('should change language when clicking different button', () => {
      renderPage();
      const chineseButton = screen.getByText('Chinese').closest('button');

      fireEvent.click(chineseButton!);

      expect(chineseButton).toHaveClass('bg-strawberry', 'text-white');
    });
  });

  describe('proficiency level selection', () => {
    it('should show JLPT levels when Japanese is selected', () => {
      renderPage();
      expect(screen.getByText('Target JLPT Level')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toHaveValue('N5');
    });

    it('should show HSK levels when Chinese is selected', () => {
      renderPage();
      const chineseButton = screen.getByText('Chinese').closest('button');
      fireEvent.click(chineseButton!);

      expect(screen.getByText('Target HSK Level')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toHaveValue('HSK3');
    });

    it('should show CEFR levels when Spanish is selected', () => {
      renderPage();
      const spanishButton = screen.getByText('Spanish').closest('button');
      fireEvent.click(spanishButton!);

      expect(screen.getByText('Target CEFR Level')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toHaveValue('A1');
    });

    it('should allow changing JLPT level', () => {
      renderPage();
      const select = screen.getByRole('combobox');

      fireEvent.change(select, { target: { value: 'N3' } });

      expect(select).toHaveValue('N3');
    });
  });

  describe('topic input', () => {
    it('should render topic textarea', () => {
      renderPage();
      expect(
        screen.getByPlaceholderText(/Tanaka's weekend activities/)
      ).toBeInTheDocument();
    });

    it('should update topic when typing', () => {
      renderPage();
      const textarea = screen.getByPlaceholderText(/Tanaka's weekend activities/);

      fireEvent.change(textarea, { target: { value: 'My test topic' } });

      expect(textarea).toHaveValue('My test topic');
    });

    it('should show different placeholder for Chinese', () => {
      renderPage();
      const chineseButton = screen.getByText('Chinese').closest('button');
      fireEvent.click(chineseButton!);

      expect(
        screen.getByPlaceholderText(/Wang Wei's weekend activities/)
      ).toBeInTheDocument();
    });

    it('should show different placeholder for Spanish', () => {
      renderPage();
      const spanishButton = screen.getByText('Spanish').closest('button');
      fireEvent.click(spanishButton!);

      expect(
        screen.getByPlaceholderText(/María's weekend activities/)
      ).toBeInTheDocument();
    });
  });

  describe('grammar focus', () => {
    it('should render grammar focus input', () => {
      renderPage();
      expect(screen.getByPlaceholderText('e.g., past vs present tense')).toBeInTheDocument();
    });

    it('should show Grammar Focus label', () => {
      renderPage();
      expect(screen.getByText('Grammar Focus (Optional)')).toBeInTheDocument();
    });
  });

  describe('buttons', () => {
    it('should render Cancel button', () => {
      renderPage();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should render Generate Pack button', () => {
      renderPage();
      expect(screen.getByText('Generate Pack')).toBeInTheDocument();
    });

    it('should disable Generate button when topic is empty', () => {
      renderPage();
      const generateButton = screen.getByText('Generate Pack').closest('button');
      expect(generateButton).toBeDisabled();
    });

    it('should enable Generate button when topic is entered', () => {
      renderPage();
      const textarea = screen.getByPlaceholderText(/Tanaka's weekend activities/);
      fireEvent.change(textarea, { target: { value: 'My topic' } });

      const generateButton = screen.getByText('Generate Pack').closest('button');
      expect(generateButton).not.toBeDisabled();
    });
  });

  describe('info section', () => {
    it('should describe 5 versions', () => {
      renderPage();
      expect(
        screen.getByText('• 5 versions of the same story with different grammar patterns')
      ).toBeInTheDocument();
    });

    it('should mention slow audio', () => {
      renderPage();
      expect(
        screen.getByText('• Slow audio (0.7x speed) for shadowing practice')
      ).toBeInTheDocument();
    });

    it('should mention furigana for Japanese', () => {
      renderPage();
      expect(
        screen.getByText(/Japanese text with furigana/)
      ).toBeInTheDocument();
    });
  });

  describe('button state', () => {
    it('should disable Generate button for whitespace-only topic', () => {
      renderPage();

      const textarea = screen.getByPlaceholderText(/Tanaka's weekend activities/);
      fireEvent.change(textarea, { target: { value: '   ' } });

      const generateButton = screen.getByText('Generate Pack').closest('button');
      // Button should be disabled because trimmed topic is empty
      expect(generateButton).toBeDisabled();
    });
  });
});
