/* eslint-disable testing-library/no-node-access */
// Testing button groups and active states requires direct node access
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
      expect(readingsButton).toHaveClass('retro-toggle-button', 'is-on');
    });

    it('should show inactive styling when showReadings is false', () => {
      render(<ViewToggleButtons {...defaultProps} showReadings={false} />);

      const readingsButton = screen.getByTestId('playback-toggle-readings');
      expect(readingsButton).toHaveClass('retro-toggle-button');
      expect(readingsButton).not.toHaveClass('is-on');
    });

    it('should show active styling when showTranslations is true', () => {
      render(<ViewToggleButtons {...defaultProps} showTranslations />);

      const translationsButton = screen.getByTestId('playback-toggle-translations');
      expect(translationsButton).toHaveClass('retro-toggle-button', 'is-on');
    });

    it('should show inactive styling when showTranslations is false', () => {
      render(<ViewToggleButtons {...defaultProps} showTranslations={false} />);

      const translationsButton = screen.getByTestId('playback-toggle-translations');
      expect(translationsButton).toHaveClass('retro-toggle-button');
      expect(translationsButton).not.toHaveClass('is-on');
    });

    it('should show both active when both are true', () => {
      render(<ViewToggleButtons {...defaultProps} showReadings showTranslations />);

      const readingsButton = screen.getByTestId('playback-toggle-readings');
      const translationsButton = screen.getByTestId('playback-toggle-translations');

      expect(readingsButton).toHaveClass('is-on');
      expect(translationsButton).toHaveClass('is-on');
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
      render(<ViewToggleButtons {...defaultProps} readingsLabel="Furigana" showReadings />);

      const readingsButton = screen.getByTestId('playback-toggle-readings');
      expect(readingsButton).toHaveAttribute('title', 'Hide furigana');
    });
  });

  describe('switch indicators', () => {
    it('should render switch indicator for readings', () => {
      render(<ViewToggleButtons {...defaultProps} showReadings />);

      const readingsButton = screen.getByTestId('playback-toggle-readings');
      const switchEl = readingsButton.querySelector('.retro-toggle-switch');
      expect(switchEl).toBeInTheDocument();
    });

    it('should render switch indicator for translations', () => {
      render(<ViewToggleButtons {...defaultProps} showReadings={false} />);

      const translationsButton = screen.getByTestId('playback-toggle-translations');
      const switchEl = translationsButton.querySelector('.retro-toggle-switch');
      expect(switchEl).toBeInTheDocument();
    });

    it('should have a switch span in each button', () => {
      render(<ViewToggleButtons {...defaultProps} />);

      const readingsButton = screen.getByTestId('playback-toggle-readings');
      const translationsButton = screen.getByTestId('playback-toggle-translations');

      expect(readingsButton.querySelectorAll('.retro-toggle-switch')).toHaveLength(1);
      expect(translationsButton.querySelectorAll('.retro-toggle-switch')).toHaveLength(1);
    });
  });

  describe('wrapper styling', () => {
    it('should have correct wrapper styling', () => {
      const { container } = render(<ViewToggleButtons {...defaultProps} />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('retro-toggle-row', 'w-full');
    });
  });
});
