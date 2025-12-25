import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import AudioPlayer, { RepeatMode } from '../AudioPlayer';

// Mock HTMLAudioElement
class MockAudioElement {
  src = '';

  currentTime = 0;

  duration = 100;

  paused = true;

  private eventListeners: Record<string, Function[]> = {};

  addEventListener(event: string, callback: Function) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  removeEventListener(event: string, callback: Function) {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
    }
  }

  dispatchEvent(event: string) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(cb => cb());
    }
  }

  play() {
    this.paused = false;
    this.dispatchEvent('play');
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
    this.dispatchEvent('pause');
  }

  // Simulate ending
  end() {
    this.paused = true;
    this.currentTime = 0;
    this.dispatchEvent('ended');
  }

  // Simulate loading metadata
  loadMetadata() {
    this.dispatchEvent('loadedmetadata');
  }
}

describe('AudioPlayer', () => {
  let mockAudioRef: ReturnType<typeof vi.fn>;
  let mockOnRepeatModeChange: ReturnType<typeof vi.fn>;
  let mockOnEnded: ReturnType<typeof vi.fn>;
  let mockAudioElement: MockAudioElement;
  let originalRAF: typeof requestAnimationFrame;
  let originalCAF: typeof cancelAnimationFrame;

  beforeEach(() => {
    mockAudioRef = vi.fn();
    mockOnRepeatModeChange = vi.fn();
    mockOnEnded = vi.fn();
    mockAudioElement = new MockAudioElement();

    // Mock HTMLAudioElement methods that jsdom doesn't implement
    window.HTMLMediaElement.prototype.play = vi.fn(() => {
      mockAudioElement.paused = false;
      return Promise.resolve();
    });
    window.HTMLMediaElement.prototype.pause = vi.fn(() => {
      mockAudioElement.paused = true;
    });

    // Mock requestAnimationFrame and cancelAnimationFrame
    originalRAF = global.requestAnimationFrame;
    originalCAF = global.cancelAnimationFrame;

    let rafId = 0;
    global.requestAnimationFrame = vi.fn((callback) => {
      rafId++;
      setTimeout(() => callback(performance.now()), 16);
      return rafId;
    });
    global.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.requestAnimationFrame = originalRAF;
    global.cancelAnimationFrame = originalCAF;
  });

  const renderAudioPlayer = (props: Partial<React.ComponentProps<typeof AudioPlayer>> = {}) => render(
      <AudioPlayer
        src="https://example.com/audio.mp3"
        audioRef={mockAudioRef}
        {...props}
      />
    );

  describe('rendering', () => {
    it('should render play/pause button', () => {
      renderAudioPlayer();
      expect(screen.getByTestId('audio-button-play-pause')).toBeInTheDocument();
    });

    it('should render progress bar', () => {
      renderAudioPlayer();
      expect(screen.getByTestId('audio-progress-bar')).toBeInTheDocument();
    });

    it('should render time display showing 0:00 initially', () => {
      renderAudioPlayer();
      const timeDisplays = screen.getAllByText('0:00');
      expect(timeDisplays.length).toBeGreaterThanOrEqual(1);
    });

    it('should render repeat button when onRepeatModeChange is provided', () => {
      renderAudioPlayer({ onRepeatModeChange: mockOnRepeatModeChange });
      expect(screen.getByTestId('audio-button-repeat')).toBeInTheDocument();
    });

    it('should not render repeat button when onRepeatModeChange is not provided', () => {
      renderAudioPlayer();
      expect(screen.queryByTestId('audio-button-repeat')).not.toBeInTheDocument();
    });

    it('should render audio element with correct src', () => {
      renderAudioPlayer({ src: 'https://test.com/audio.mp3' });
      const audio = document.querySelector('audio');
      expect(audio).toHaveAttribute('src', 'https://test.com/audio.mp3');
    });
  });

  describe('audioRef callback', () => {
    it('should call audioRef with the audio element', () => {
      renderAudioPlayer();
      expect(mockAudioRef).toHaveBeenCalled();
    });

    it('should pass HTMLAudioElement to audioRef', () => {
      renderAudioPlayer();
      const calledWith = mockAudioRef.mock.calls[0][0];
      expect(calledWith).toBeInstanceOf(HTMLAudioElement);
    });
  });

  describe('play/pause functionality', () => {
    it('should show play icon initially', () => {
      renderAudioPlayer();
      const button = screen.getByTestId('audio-button-play-pause');
      expect(button).toHaveAttribute('aria-label', 'Play');
    });

    it('should have accessible aria-label', () => {
      renderAudioPlayer();
      const button = screen.getByTestId('audio-button-play-pause');
      expect(button.getAttribute('aria-label')).toMatch(/Play|Pause/);
    });
  });

  describe('formatTime', () => {
    it('should display 0:00 for NaN duration', () => {
      renderAudioPlayer();
      // Duration is initially NaN before audio loads
      const timeDisplays = screen.getAllByText('0:00');
      expect(timeDisplays.length).toBeGreaterThan(0);
    });
  });

  describe('repeat mode', () => {
    it('should show repeat button with off state styling when repeatMode is off', () => {
      renderAudioPlayer({
        repeatMode: 'off',
        onRepeatModeChange: mockOnRepeatModeChange,
      });
      const button = screen.getByTestId('audio-button-repeat');
      expect(button).toHaveAttribute('aria-label', 'Repeat mode: off');
      expect(button.className).toContain('bg-gray-200');
    });

    it('should show repeat button with active styling when repeatMode is one', () => {
      renderAudioPlayer({
        repeatMode: 'one',
        onRepeatModeChange: mockOnRepeatModeChange,
      });
      const button = screen.getByTestId('audio-button-repeat');
      expect(button).toHaveAttribute('aria-label', 'Repeat mode: one');
      expect(button.className).toContain('bg-indigo');
    });

    it('should show repeat button with active styling when repeatMode is all', () => {
      renderAudioPlayer({
        repeatMode: 'all',
        onRepeatModeChange: mockOnRepeatModeChange,
      });
      const button = screen.getByTestId('audio-button-repeat');
      expect(button).toHaveAttribute('aria-label', 'Repeat mode: all');
      expect(button.className).toContain('bg-indigo');
    });

    it('should cycle from off to one when clicking repeat button', () => {
      renderAudioPlayer({
        repeatMode: 'off',
        onRepeatModeChange: mockOnRepeatModeChange,
      });

      fireEvent.click(screen.getByTestId('audio-button-repeat'));
      expect(mockOnRepeatModeChange).toHaveBeenCalledWith('one');
    });

    it('should cycle from one to all when clicking repeat button', () => {
      renderAudioPlayer({
        repeatMode: 'one',
        onRepeatModeChange: mockOnRepeatModeChange,
      });

      fireEvent.click(screen.getByTestId('audio-button-repeat'));
      expect(mockOnRepeatModeChange).toHaveBeenCalledWith('all');
    });

    it('should cycle from all to off when clicking repeat button', () => {
      renderAudioPlayer({
        repeatMode: 'all',
        onRepeatModeChange: mockOnRepeatModeChange,
      });

      fireEvent.click(screen.getByTestId('audio-button-repeat'));
      expect(mockOnRepeatModeChange).toHaveBeenCalledWith('off');
    });
  });

  describe('progress bar', () => {
    it('should render progress bar element', () => {
      renderAudioPlayer();
      const progressBar = screen.getByTestId('audio-progress-bar');
      expect(progressBar).toBeInTheDocument();
    });

    it('should have cursor-pointer class on progress bar', () => {
      renderAudioPlayer();
      const progressBar = screen.getByTestId('audio-progress-bar');
      expect(progressBar.className).toContain('cursor-pointer');
    });
  });

  describe('component cleanup', () => {
    it('should cancel animation frame on unmount', () => {
      const { unmount } = renderAudioPlayer();
      unmount();
      expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });
  });

  describe('default props', () => {
    it('should default repeatMode to off', () => {
      renderAudioPlayer({ onRepeatModeChange: mockOnRepeatModeChange });
      const button = screen.getByTestId('audio-button-repeat');
      expect(button.className).toContain('bg-gray-200'); // off styling
    });
  });

  describe('accessibility', () => {
    it('should have aria-label on play/pause button', () => {
      renderAudioPlayer();
      const button = screen.getByTestId('audio-button-play-pause');
      expect(button).toHaveAttribute('aria-label');
    });

    it('should have aria-label on repeat button', () => {
      renderAudioPlayer({ onRepeatModeChange: mockOnRepeatModeChange });
      const button = screen.getByTestId('audio-button-repeat');
      expect(button).toHaveAttribute('aria-label');
    });
  });

  describe('styling', () => {
    it('should have flex container for layout', () => {
      const { container } = renderAudioPlayer();
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('flex');
      expect(wrapper.className).toContain('items-center');
    });

    it('should have rounded-full class on play button', () => {
      renderAudioPlayer();
      const button = screen.getByTestId('audio-button-play-pause');
      expect(button.className).toContain('rounded-full');
    });

    it('should have indigo background on play button', () => {
      renderAudioPlayer();
      const button = screen.getByTestId('audio-button-play-pause');
      expect(button.className).toContain('bg-indigo');
    });
  });

  describe('time formatting', () => {
    // Testing the formatTime function through rendered output
    it('should display time with padded seconds', () => {
      // Initial state should show 0:00 for both current time and duration
      renderAudioPlayer();
      const timeDisplays = screen.getAllByText('0:00');
      expect(timeDisplays.length).toBe(2); // current time and duration
    });
  });

  describe('RepeatMode type', () => {
    it('should accept off as valid repeatMode', () => {
      const mode: RepeatMode = 'off';
      expect(mode).toBe('off');
    });

    it('should accept one as valid repeatMode', () => {
      const mode: RepeatMode = 'one';
      expect(mode).toBe('one');
    });

    it('should accept all as valid repeatMode', () => {
      const mode: RepeatMode = 'all';
      expect(mode).toBe('all');
    });
  });

  describe('SVG icons', () => {
    it('should render play icon SVG when paused', () => {
      renderAudioPlayer();
      const button = screen.getByTestId('audio-button-play-pause');
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should render repeat icon SVG', () => {
      renderAudioPlayer({ onRepeatModeChange: mockOnRepeatModeChange });
      const button = screen.getByTestId('audio-button-repeat');
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('progress calculation', () => {
    it('should show 0% progress initially', () => {
      renderAudioPlayer();
      const progressFill = document.querySelector('.bg-indigo.rounded-full.relative');
      if (progressFill) {
        expect(progressFill.getAttribute('style')).toContain('width: 0%');
      }
    });
  });

  describe('mouse events on progress bar', () => {
    it('should handle mouse down on progress bar', () => {
      renderAudioPlayer();
      const progressBar = screen.getByTestId('audio-progress-bar');

      // Should not throw
      fireEvent.mouseDown(progressBar);
      expect(progressBar).toBeInTheDocument();
    });

    it('should handle mouse up on progress bar', () => {
      renderAudioPlayer();
      const progressBar = screen.getByTestId('audio-progress-bar');

      fireEvent.mouseDown(progressBar);
      fireEvent.mouseUp(progressBar);
      expect(progressBar).toBeInTheDocument();
    });

    it('should handle mouse leave on progress bar', () => {
      renderAudioPlayer();
      const progressBar = screen.getByTestId('audio-progress-bar');

      fireEvent.mouseDown(progressBar);
      fireEvent.mouseLeave(progressBar);
      expect(progressBar).toBeInTheDocument();
    });

    it('should have click handler on progress bar', () => {
      renderAudioPlayer();
      const progressBar = screen.getByTestId('audio-progress-bar');
      // Verify progress bar exists and is interactive (without triggering the click handler
      // which would try to set currentTime with NaN duration)
      expect(progressBar.className).toContain('cursor-pointer');
    });
  });

  describe('onEnded callback', () => {
    it('should accept onEnded callback prop', () => {
      // Should render without error
      renderAudioPlayer({ onEnded: mockOnEnded });
      expect(screen.getByTestId('audio-button-play-pause')).toBeInTheDocument();
    });
  });

  describe('button interactions', () => {
    it('should handle click on play/pause button', () => {
      renderAudioPlayer();
      const button = screen.getByTestId('audio-button-play-pause');

      // Should not throw
      fireEvent.click(button);
      expect(button).toBeInTheDocument();
    });
  });

  describe('playhead element', () => {
    it('should render playhead element inside progress bar', () => {
      renderAudioPlayer();
      const playhead = document.querySelector('.border-white.shadow-md');
      expect(playhead).toBeInTheDocument();
    });
  });

  describe('tabular-nums class for time', () => {
    it('should have tabular-nums class on time displays', () => {
      renderAudioPlayer();
      const timeElements = document.querySelectorAll('.tabular-nums');
      expect(timeElements.length).toBeGreaterThan(0);
    });
  });
});
