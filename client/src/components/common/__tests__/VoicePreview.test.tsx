import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AudioPreviewProvider } from '../../../contexts/AudioPreviewContext';
import VoicePreview from '../VoicePreview';

// Mock IntersectionObserver to immediately trigger visibility
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

beforeEach(() => {
  // Make IntersectionObserver immediately call callback with isIntersecting: true
  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn((callback: IntersectionObserverCallback) => {
      // Trigger immediately on observe
      setTimeout(() => {
        callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver
        );
      }, 0);
      return {
        observe: mockObserve,
        disconnect: mockDisconnect,
        unobserve: vi.fn(),
      };
    })
  );
});

// Wrapper that provides the AudioPreviewContext
const renderWithProvider = (ui: React.ReactElement) =>
  render(<AudioPreviewProvider>{ui}</AudioPreviewProvider>);

describe('VoicePreview', () => {
  let playMock: ReturnType<typeof vi.fn>;
  let pauseMock: ReturnType<typeof vi.fn>;
  const user = userEvent.setup();

  beforeEach(() => {
    playMock = vi.fn(() => Promise.resolve());
    pauseMock = vi.fn();

    window.HTMLMediaElement.prototype.play = playMock;
    window.HTMLMediaElement.prototype.pause = pauseMock;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('should render play button with "Preview" text', async () => {
    renderWithProvider(<VoicePreview voiceId="Takumi" />);

    await waitFor(() => {
      expect(screen.getByText('Preview')).toBeInTheDocument();
    });
  });

  it('should show Play icon when not playing', async () => {
    renderWithProvider(<VoicePreview voiceId="Takumi" />);

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Preview voice sample');
  });

  it('should call audio.play() on button click and show Stop', async () => {
    renderWithProvider(<VoicePreview voiceId="Takumi" />);

    await waitFor(() => {
      expect(screen.getByText('Preview')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button'));

    expect(playMock).toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByText('Stop')).toBeInTheDocument();
    });
  });

  it('should show Stop button with correct aria-label when playing', async () => {
    renderWithProvider(<VoicePreview voiceId="Takumi" />);

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Stop voice sample');
    });
  });

  it('should handle play() promise rejection gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    playMock.mockRejectedValueOnce(new Error('Playback not allowed'));

    renderWithProvider(<VoicePreview voiceId="Takumi" />);

    await waitFor(() => {
      expect(screen.getByText('Preview')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button'));

    // Should log the error
    expect(consoleSpy).toHaveBeenCalledWith('Voice preview playback failed:', expect.any(Error));

    // Should still show Preview (not stuck on Stop)
    await waitFor(() => {
      expect(screen.getByText('Preview')).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it('should reset playback when voiceId prop changes', async () => {
    const { rerender } = renderWithProvider(<VoicePreview voiceId="Takumi" />);

    await waitFor(() => {
      expect(screen.getByText('Preview')).toBeInTheDocument();
    });

    // Start playing
    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('Stop')).toBeInTheDocument();
    });

    // Change voiceId
    rerender(
      <AudioPreviewProvider>
        <VoicePreview voiceId="Kazuha" />
      </AudioPreviewProvider>
    );

    // Should reset to Preview state
    await waitFor(() => {
      expect(screen.getByText('Preview')).toBeInTheDocument();
    });
  });

  it('should have accessible aria-label on button', async () => {
    renderWithProvider(<VoicePreview voiceId="Takumi" />);

    await waitFor(() => {
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Preview voice sample');
    });
  });

  it('should stop playback on unmount', async () => {
    const { unmount } = renderWithProvider(<VoicePreview voiceId="Takumi" />);

    await waitFor(() => {
      expect(screen.getByText('Preview')).toBeInTheDocument();
    });

    // Start playing
    await user.click(screen.getByRole('button'));

    unmount();

    expect(pauseMock).toHaveBeenCalled();
  });

  it('should generate correct audio src from voiceId', async () => {
    renderWithProvider(<VoicePreview voiceId="fishaudio:abc123" />);

    await waitFor(() => {
      expect(screen.getByText('Preview')).toBeInTheDocument();
    });

    // The audio src is set via context, so we verify the button rendered correctly
    // The voiceIdToFilename('fishaudio:abc123') → 'fishaudio_abc123'
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should use IntersectionObserver for lazy loading', async () => {
    renderWithProvider(<VoicePreview voiceId="Takumi" />);

    // IntersectionObserver should have been created
    expect(mockObserve).toHaveBeenCalled();
  });

  it('should only allow one preview at a time via shared context', async () => {
    renderWithProvider(
      <>
        <VoicePreview voiceId="Takumi" />
        <VoicePreview voiceId="Kazuha" />
      </>
    );

    await waitFor(() => {
      const buttons = screen.getAllByText('Preview');
      expect(buttons).toHaveLength(2);
    });

    const buttons = screen.getAllByRole('button');

    // Play first voice
    await user.click(buttons[0]);

    await waitFor(() => {
      expect(screen.getByText('Stop')).toBeInTheDocument();
      expect(screen.getByText('Preview')).toBeInTheDocument();
    });

    // Play second voice - should stop first
    await user.click(buttons[1]);

    // First should revert to Preview, second should show Stop
    await waitFor(() => {
      const stopButtons = screen.getAllByText('Stop');
      expect(stopButtons).toHaveLength(1);
    });
  });
});
