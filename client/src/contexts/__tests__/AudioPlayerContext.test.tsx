import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { AudioPlayerProvider, useAudioPlayerContext } from '../AudioPlayerContext';
import { ReactNode } from 'react';

function TestComponent() {
  const { audioUrl, title, speed, setAudioInfo, clearAudio } = useAudioPlayerContext();

  return (
    <div>
      <span data-testid="audio-url">{audioUrl || 'null'}</span>
      <span data-testid="title">{title || 'null'}</span>
      <span data-testid="speed">{speed || 'null'}</span>
      <button onClick={() => setAudioInfo('test.mp3', 'Test Song', 'medium')} data-testid="set-audio">
        Set Audio
      </button>
      <button onClick={clearAudio} data-testid="clear-audio">
        Clear Audio
      </button>
    </div>
  );
}

function wrapper({ children }: { children: ReactNode }) {
  return <AudioPlayerProvider>{children}</AudioPlayerProvider>;
}

describe('AudioPlayerContext', () => {
  describe('Provider', () => {
    it('should render children', () => {
      render(
        <AudioPlayerProvider>
          <div data-testid="child">Hello</div>
        </AudioPlayerProvider>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
  });

  describe('Initial State', () => {
    it('should have null audioUrl initially', () => {
      render(
        <AudioPlayerProvider>
          <TestComponent />
        </AudioPlayerProvider>
      );

      expect(screen.getByTestId('audio-url')).toHaveTextContent('null');
    });

    it('should have null title initially', () => {
      render(
        <AudioPlayerProvider>
          <TestComponent />
        </AudioPlayerProvider>
      );

      expect(screen.getByTestId('title')).toHaveTextContent('null');
    });

    it('should have null speed initially', () => {
      render(
        <AudioPlayerProvider>
          <TestComponent />
        </AudioPlayerProvider>
      );

      expect(screen.getByTestId('speed')).toHaveTextContent('null');
    });
  });

  describe('setAudioInfo', () => {
    it('should update audioUrl', () => {
      render(
        <AudioPlayerProvider>
          <TestComponent />
        </AudioPlayerProvider>
      );

      act(() => {
        screen.getByTestId('set-audio').click();
      });

      expect(screen.getByTestId('audio-url')).toHaveTextContent('test.mp3');
    });

    it('should update title', () => {
      render(
        <AudioPlayerProvider>
          <TestComponent />
        </AudioPlayerProvider>
      );

      act(() => {
        screen.getByTestId('set-audio').click();
      });

      expect(screen.getByTestId('title')).toHaveTextContent('Test Song');
    });

    it('should update speed', () => {
      render(
        <AudioPlayerProvider>
          <TestComponent />
        </AudioPlayerProvider>
      );

      act(() => {
        screen.getByTestId('set-audio').click();
      });

      expect(screen.getByTestId('speed')).toHaveTextContent('medium');
    });
  });

  describe('clearAudio', () => {
    it('should reset audioUrl to null', () => {
      render(
        <AudioPlayerProvider>
          <TestComponent />
        </AudioPlayerProvider>
      );

      // Set audio first
      act(() => {
        screen.getByTestId('set-audio').click();
      });
      expect(screen.getByTestId('audio-url')).toHaveTextContent('test.mp3');

      // Clear audio
      act(() => {
        screen.getByTestId('clear-audio').click();
      });
      expect(screen.getByTestId('audio-url')).toHaveTextContent('null');
    });

    it('should reset title to null', () => {
      render(
        <AudioPlayerProvider>
          <TestComponent />
        </AudioPlayerProvider>
      );

      act(() => {
        screen.getByTestId('set-audio').click();
      });
      expect(screen.getByTestId('title')).toHaveTextContent('Test Song');

      act(() => {
        screen.getByTestId('clear-audio').click();
      });
      expect(screen.getByTestId('title')).toHaveTextContent('null');
    });

    it('should reset speed to null', () => {
      render(
        <AudioPlayerProvider>
          <TestComponent />
        </AudioPlayerProvider>
      );

      act(() => {
        screen.getByTestId('set-audio').click();
      });
      expect(screen.getByTestId('speed')).toHaveTextContent('medium');

      act(() => {
        screen.getByTestId('clear-audio').click();
      });
      expect(screen.getByTestId('speed')).toHaveTextContent('null');
    });
  });

  describe('useAudioPlayerContext Hook', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAudioPlayerContext());
      }).toThrow('useAudioPlayerContext must be used within an AudioPlayerProvider');

      consoleSpy.mockRestore();
    });

    it('should work when used inside provider', () => {
      const { result } = renderHook(() => useAudioPlayerContext(), { wrapper });

      expect(result.current.audioUrl).toBeNull();
      expect(result.current.title).toBeNull();
      expect(result.current.speed).toBeNull();
      expect(typeof result.current.setAudioInfo).toBe('function');
      expect(typeof result.current.clearAudio).toBe('function');
    });

    it('should update values through setAudioInfo', () => {
      const { result } = renderHook(() => useAudioPlayerContext(), { wrapper });

      act(() => {
        result.current.setAudioInfo('new-url.mp3', 'New Title', 'slow');
      });

      expect(result.current.audioUrl).toBe('new-url.mp3');
      expect(result.current.title).toBe('New Title');
      expect(result.current.speed).toBe('slow');
    });

    it('should clear values through clearAudio', () => {
      const { result } = renderHook(() => useAudioPlayerContext(), { wrapper });

      act(() => {
        result.current.setAudioInfo('test.mp3', 'Test', 'normal');
      });

      expect(result.current.audioUrl).toBe('test.mp3');

      act(() => {
        result.current.clearAudio();
      });

      expect(result.current.audioUrl).toBeNull();
      expect(result.current.title).toBeNull();
      expect(result.current.speed).toBeNull();
    });
  });

  describe('Multiple Updates', () => {
    it('should handle multiple setAudioInfo calls', () => {
      const { result } = renderHook(() => useAudioPlayerContext(), { wrapper });

      act(() => {
        result.current.setAudioInfo('first.mp3', 'First', 'slow');
      });
      expect(result.current.audioUrl).toBe('first.mp3');

      act(() => {
        result.current.setAudioInfo('second.mp3', 'Second', 'medium');
      });
      expect(result.current.audioUrl).toBe('second.mp3');
      expect(result.current.title).toBe('Second');
      expect(result.current.speed).toBe('medium');
    });

    it('should handle set, clear, set sequence', () => {
      const { result } = renderHook(() => useAudioPlayerContext(), { wrapper });

      act(() => {
        result.current.setAudioInfo('first.mp3', 'First', 'slow');
      });
      expect(result.current.audioUrl).toBe('first.mp3');

      act(() => {
        result.current.clearAudio();
      });
      expect(result.current.audioUrl).toBeNull();

      act(() => {
        result.current.setAudioInfo('third.mp3', 'Third', 'normal');
      });
      expect(result.current.audioUrl).toBe('third.mp3');
    });
  });

  describe('Context Value Types', () => {
    it('should return proper types for all context values', () => {
      const { result } = renderHook(() => useAudioPlayerContext(), { wrapper });

      // Check types
      expect(result.current.audioUrl === null || typeof result.current.audioUrl === 'string').toBe(true);
      expect(result.current.title === null || typeof result.current.title === 'string').toBe(true);
      expect(result.current.speed === null || typeof result.current.speed === 'string').toBe(true);
      expect(typeof result.current.setAudioInfo).toBe('function');
      expect(typeof result.current.clearAudio).toBe('function');
    });
  });
});
