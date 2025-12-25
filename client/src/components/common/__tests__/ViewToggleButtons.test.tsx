import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ViewToggleButtons from '../ViewToggleButtons';

describe('ViewToggleButtons', () => {
  const defaultProps = {
    showReadings: false,
    showTranslations: false,
    onToggleReadings: vi.fn(),
    onToggleTranslations: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render both toggle buttons', () => {
      render(<ViewToggleButtons {...defaultProps} />);

      expect(screen.getByTestId('playback-toggle-readings')).toBeInTheDocument();
      expect(screen.getByTestId('playback-toggle-translations')).toBeInTheDocument();
    });

    it('should render default Furigana label', () => {
      render(<ViewToggleButtons {...defaultProps} />);

      expect(screen.getByText('Furigana')).toBeInTheDocument();
    });

    it('should render English label', () => {
      render(<ViewToggleButtons {...defaultProps} />);

      expect(screen.getByText('English')).toBeInTheDocument();
    });

    it('should render custom readings label', () => {
      render(<ViewToggleButtons {...defaultProps} readingsLabel="Pinyin" />);

      expect(screen.getByText('Pinyin')).toBeInTheDocument();
      expect(screen.queryByText('Furigana')).not.toBeInTheDocument();
    });
  });

  describe('toggle interactions', () => {
    it('should call onToggleReadings when readings button is clicked', () => {
      const onToggleReadings = vi.fn();
      render(<ViewToggleButtons {...defaultProps} onToggleReadings={onToggleReadings} />);

      fireEvent.click(screen.getByTestId('playback-toggle-readings'));

      expect(onToggleReadings).toHaveBeenCalledTimes(1);
    });

    it('should call onToggleTranslations when translations button is clicked', () => {
      const onToggleTranslations = vi.fn();
      render(<ViewToggleButtons {...defaultProps} onToggleTranslations={onToggleTranslations} />);

      fireEvent.click(screen.getByTestId('playback-toggle-translations'));

      expect(onToggleTranslations).toHaveBeenCalledTimes(1);
    });
  });

  describe('active state styling', () => {
    it('should show active styling when showReadings is true', () => {
      render(<ViewToggleButtons {...defaultProps} showReadings />);

      const readingsButton = screen.getByTestId('playback-toggle-readings');
      expect(readingsButton).toHaveClass('bg-periwinkle', 'text-white', 'shadow-md');
    });

    it('should show inactive styling when showReadings is false', () => {
      render(<ViewToggleButtons {...defaultProps} showReadings={false} />);

      const readingsButton = screen.getByTestId('playback-toggle-readings');
      expect(readingsButton).toHaveClass('text-navy');
      expect(readingsButton).not.toHaveClass('bg-periwinkle');
    });

    it('should show active styling when showTranslations is true', () => {
      render(<ViewToggleButtons {...defaultProps} showTranslations />);

      const translationsButton = screen.getByTestId('playback-toggle-translations');
      expect(translationsButton).toHaveClass('bg-coral', 'text-white', 'shadow-md');
    });

    it('should show inactive styling when showTranslations is false', () => {
      render(<ViewToggleButtons {...defaultProps} showTranslations={false} />);

      const translationsButton = screen.getByTestId('playback-toggle-translations');
      expect(translationsButton).toHaveClass('text-navy');
      expect(translationsButton).not.toHaveClass('bg-coral');
    });

    it('should show both active when both are true', () => {
      render(<ViewToggleButtons {...defaultProps} showReadings showTranslations />);

      const readingsButton = screen.getByTestId('playback-toggle-readings');
      const translationsButton = screen.getByTestId('playback-toggle-translations');

      expect(readingsButton).toHaveClass('bg-periwinkle');
      expect(translationsButton).toHaveClass('bg-coral');
    });
  });

  describe('accessibility', () => {
    it('should have correct title when readings are shown', () => {
      render(<ViewToggleButtons {...defaultProps} showReadings />);

      const readingsButton = screen.getByTestId('playback-toggle-readings');
      expect(readingsButton).toHaveAttribute('title', 'Hide furigana');
    });

    it('should have correct title when readings are hidden', () => {
      render(<ViewToggleButtons {...defaultProps} showReadings={false} />);

      const readingsButton = screen.getByTestId('playback-toggle-readings');
      expect(readingsButton).toHaveAttribute('title', 'Show furigana');
    });

    it('should have correct title when translations are shown', () => {
      render(<ViewToggleButtons {...defaultProps} showTranslations />);

      const translationsButton = screen.getByTestId('playback-toggle-translations');
      expect(translationsButton).toHaveAttribute('title', 'Hide English');
    });

    it('should have correct title when translations are hidden', () => {
      render(<ViewToggleButtons {...defaultProps} showTranslations={false} />);

      const translationsButton = screen.getByTestId('playback-toggle-translations');
      expect(translationsButton).toHaveAttribute('title', 'Show English');
    });

    it('should use custom label in title', () => {
      render(<ViewToggleButtons {...defaultProps} readingsLabel="Pinyin" showReadings />);

      const readingsButton = screen.getByTestId('playback-toggle-readings');
      expect(readingsButton).toHaveAttribute('title', 'Hide pinyin');
    });
  });

  describe('icons', () => {
    it('should render Eye icon when readings are shown', () => {
      const { container } = render(<ViewToggleButtons {...defaultProps} showReadings />);

      const readingsButton = screen.getByTestId('playback-toggle-readings');
      const svg = readingsButton.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should render EyeOff icon when readings are hidden', () => {
      const { container } = render(<ViewToggleButtons {...defaultProps} showReadings={false} />);

      const readingsButton = screen.getByTestId('playback-toggle-readings');
      const svg = readingsButton.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should have correct icon sizes', () => {
      render(<ViewToggleButtons {...defaultProps} />);

      const readingsButton = screen.getByTestId('playback-toggle-readings');
      const svg = readingsButton.querySelector('svg');
      expect(svg).toHaveClass('w-3.5', 'h-3.5');
    });
  });

  describe('wrapper styling', () => {
    it('should have correct wrapper styling', () => {
      const { container } = render(<ViewToggleButtons {...defaultProps} />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('flex', 'items-center', 'gap-1', 'bg-white', 'rounded-lg', 'p-1', 'shadow-sm');
    });
  });
});
