import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioPlayer } from '../useAudioPlayer';

describe('useAudioPlayer', () => {
  let mockAudioElement: Partial<HTMLAudioElement>;
  let eventListeners: Map<string, EventListener>;

  beforeEach(() => {
    eventListeners = new Map();

    mockAudioElement = {
      currentTime: 0,
      duration: 100,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      addEventListener: vi.fn((event: string, handler: EventListener) => {
        eventListeners.set(event, handler);
      }),
      removeEventListener: vi.fn((event: string) => {
        eventListeners.delete(event);
      }),
    };
  });

  it('should return initial state', () => {
    const { result } = renderHook(() => useAudioPlayer());

    expect(result.current.currentTime).toBe(0);
    expect(result.current.duration).toBe(0);
    expect(result.current.isPlaying).toBe(false);
    expect(typeof result.current.audioRef).toBe('function');
    expect(typeof result.current.play).toBe('function');
    expect(typeof result.current.pause).toBe('function');
    expect(typeof result.current.seek).toBe('function');
  });

  it('should attach event listeners when audioRef is called with an element', () => {
    const { result } = renderHook(() => useAudioPlayer());

    act(() => {
      result.current.audioRef(mockAudioElement as HTMLAudioElement);
    });

    expect(mockAudioElement.addEventListener).toHaveBeenCalledWith('timeupdate', expect.any(Function));
    expect(mockAudioElement.addEventListener).toHaveBeenCalledWith('loadedmetadata', expect.any(Function));
    expect(mockAudioElement.addEventListener).toHaveBeenCalledWith('play', expect.any(Function));
    expect(mockAudioElement.addEventListener).toHaveBeenCalledWith('pause', expect.any(Function));
    expect(mockAudioElement.addEventListener).toHaveBeenCalledWith('ended', expect.any(Function));
  });

  it('should remove event listeners when audioRef is called with null', () => {
    const { result } = renderHook(() => useAudioPlayer());

    // First, set the element
    act(() => {
      result.current.audioRef(mockAudioElement as HTMLAudioElement);
    });

    // Then, clear it
    act(() => {
      result.current.audioRef(null);
    });

    expect(mockAudioElement.removeEventListener).toHaveBeenCalledWith('timeupdate', expect.any(Function));
    expect(mockAudioElement.removeEventListener).toHaveBeenCalledWith('loadedmetadata', expect.any(Function));
    expect(mockAudioElement.removeEventListener).toHaveBeenCalledWith('play', expect.any(Function));
    expect(mockAudioElement.removeEventListener).toHaveBeenCalledWith('pause', expect.any(Function));
    expect(mockAudioElement.removeEventListener).toHaveBeenCalledWith('ended', expect.any(Function));
  });

  it('should call play on the audio element', () => {
    const { result } = renderHook(() => useAudioPlayer());

    act(() => {
      result.current.audioRef(mockAudioElement as HTMLAudioElement);
    });

    result.current.play();

    expect(mockAudioElement.play).toHaveBeenCalled();
  });

  it('should call pause on the audio element', () => {
    const { result } = renderHook(() => useAudioPlayer());

    act(() => {
      result.current.audioRef(mockAudioElement as HTMLAudioElement);
    });

    result.current.pause();

    expect(mockAudioElement.pause).toHaveBeenCalled();
  });

  it('should set currentTime when seek is called', () => {
    const { result } = renderHook(() => useAudioPlayer());

    act(() => {
      result.current.audioRef(mockAudioElement as HTMLAudioElement);
    });

    result.current.seek(50);

    expect(mockAudioElement.currentTime).toBe(50);
  });

  it('should update isPlaying when play event fires', () => {
    const { result } = renderHook(() => useAudioPlayer());

    act(() => {
      result.current.audioRef(mockAudioElement as HTMLAudioElement);
    });

    expect(result.current.isPlaying).toBe(false);

    // Simulate play event
    act(() => {
      const playHandler = eventListeners.get('play');
      if (playHandler) playHandler(new Event('play'));
    });

    expect(result.current.isPlaying).toBe(true);
  });

  it('should update isPlaying when pause event fires', () => {
    const { result } = renderHook(() => useAudioPlayer());

    act(() => {
      result.current.audioRef(mockAudioElement as HTMLAudioElement);
    });

    // Set to playing first
    act(() => {
      const playHandler = eventListeners.get('play');
      if (playHandler) playHandler(new Event('play'));
    });

    expect(result.current.isPlaying).toBe(true);

    // Then pause
    act(() => {
      const pauseHandler = eventListeners.get('pause');
      if (pauseHandler) pauseHandler(new Event('pause'));
    });

    expect(result.current.isPlaying).toBe(false);
  });

  it('should reset state when ended event fires', () => {
    const { result } = renderHook(() => useAudioPlayer());

    act(() => {
      result.current.audioRef(mockAudioElement as HTMLAudioElement);
    });

    // Set to playing
    act(() => {
      const playHandler = eventListeners.get('play');
      if (playHandler) playHandler(new Event('play'));
    });

    expect(result.current.isPlaying).toBe(true);

    // Trigger ended
    act(() => {
      const endedHandler = eventListeners.get('ended');
      if (endedHandler) endedHandler(new Event('ended'));
    });

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentTime).toBe(0);
  });

  it('should do nothing when play/pause/seek called without audio element', () => {
    const { result } = renderHook(() => useAudioPlayer());

    // These should not throw
    result.current.play();
    result.current.pause();
    result.current.seek(50);

    expect(result.current.isPlaying).toBe(false);
  });
});
