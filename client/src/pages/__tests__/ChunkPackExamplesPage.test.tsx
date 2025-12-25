import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, useParams } from 'react-router-dom';
import ChunkPackExamplesPage from '../ChunkPackExamplesPage';

// Mock useParams
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn(() => ({ packId: 'test-pack-123' })),
    useNavigate: () => vi.fn(),
  };
});

// Mock useAudioPlayer hook
vi.mock('../../hooks/useAudioPlayer', () => ({
  useAudioPlayer: () => ({
    currentTime: 0,
    audioRef: { current: null },
    play: vi.fn(),
    pause: vi.fn(),
    isPlaying: false,
  }),
}));

// Mock AudioPlayer component
vi.mock('../../components/AudioPlayer', () => ({
  default: () => <div data-testid="audio-player">Audio Player</div>,
}));

// Mock SpeedSelector component
vi.mock('../../components/common/SpeedSelector', () => ({
  default: ({ selectedSpeed }: { selectedSpeed: number }) => (
    <div data-testid="speed-selector">Speed: {selectedSpeed}</div>
  ),
}));

// Mock fetch
global.fetch = vi.fn();

describe('ChunkPackExamplesPage', () => {
  const mockPack = {
    id: 'test-pack-123',
    title: 'Daily Routine Chunks',
    chunks: [
      {
        id: 'chunk-1',
        form: '～てから',
        translation: 'After doing ~',
        examples: [
          {
            id: 'ex-1',
            order: 1,
            sentence: 'ご飯を食べてから、出かけます。',
            english: 'After eating, I will go out.',
            audioUrl: 'https://storage.example.com/audio1.mp3',
            audioUrl_0_7: 'https://storage.example.com/audio1_slow.mp3',
            audioUrl_0_85: 'https://storage.example.com/audio1_medium.mp3',
            audioUrl_1_0: 'https://storage.example.com/audio1_normal.mp3',
          },
          {
            id: 'ex-2',
            order: 2,
            sentence: '宿題をしてから、テレビを見ます。',
            english: 'After doing homework, I watch TV.',
            audioUrl: 'https://storage.example.com/audio2.mp3',
          },
        ],
      },
      {
        id: 'chunk-2',
        form: '～たい',
        translation: 'Want to ~',
        examples: [
          {
            id: 'ex-3',
            order: 1,
            sentence: '日本に行きたいです。',
            english: 'I want to go to Japan.',
            audioUrl: 'https://storage.example.com/audio3.mp3',
          },
        ],
      },
    ],
  };

  const renderPage = () => render(
      <BrowserRouter>
        <ChunkPackExamplesPage />
      </BrowserRouter>
    );

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve(mockPack),
    });
  });

  describe('loading state', () => {
    it('should show loading spinner initially', () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { container } = renderPage();
      const loader = container.querySelector('.animate-spin');
      expect(loader).toBeInTheDocument();
    });
  });

  describe('rendering after load', () => {
    it('should render the page header', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Step 1: Examples with Audio')).toBeInTheDocument();
      });
    });

    it('should render pack title', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Daily Routine Chunks')).toBeInTheDocument();
      });
    });

    it('should render chunk forms', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('～てから')).toBeInTheDocument();
        expect(screen.getByText('～たい')).toBeInTheDocument();
      });
    });

    it('should render chunk translations', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('After doing ~')).toBeInTheDocument();
        expect(screen.getByText('Want to ~')).toBeInTheDocument();
      });
    });

    it('should render example sentences', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('ご飯を食べてから、出かけます。')).toBeInTheDocument();
        expect(screen.getByText('宿題をしてから、テレビを見ます。')).toBeInTheDocument();
        expect(screen.getByText('日本に行きたいです。')).toBeInTheDocument();
      });
    });

    it('should render example translations', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('After eating, I will go out.')).toBeInTheDocument();
        expect(screen.getByText('I want to go to Japan.')).toBeInTheDocument();
      });
    });
  });

  describe('audio player', () => {
    it('should render audio player when example has audio', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('audio-player')).toBeInTheDocument();
      });
    });
  });

  describe('speed selector', () => {
    it('should render speed selector', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('speed-selector')).toBeInTheDocument();
      });
    });

    it('should show default speed', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Speed: 0.85')).toBeInTheDocument();
      });
    });
  });

  describe('navigation', () => {
    it('should render next button', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Next: Story')).toBeInTheDocument();
      });
    });
  });

  describe('API calls', () => {
    it('should fetch pack data on mount', async () => {
      renderPage();

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/chunk-packs/test-pack-123'),
          expect.objectContaining({ credentials: 'include' })
        );
      });
    });
  });

  describe('error handling', () => {
    it('should handle fetch errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      renderPage();

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to load pack:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });
});
