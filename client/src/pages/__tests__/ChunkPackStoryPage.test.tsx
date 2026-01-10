import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ChunkPackStoryPage from '../ChunkPackStoryPage';

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
    seek: vi.fn(),
    play: vi.fn(),
  }),
}));

// Mock AudioPlayer component
vi.mock('../../components/AudioPlayer', () => ({
  default: () => <div data-testid="audio-player">Audio Player</div>,
}));

// Mock getSpeakerColor
vi.mock('../../../../shared/src/constants-new', () => ({
  getSpeakerColor: (index: number) => ['#3B82F6', '#10B981', '#F59E0B'][index % 3],
}));

// Mock fetch
global.fetch = vi.fn();

// Mock scrollIntoView (not implemented in jsdom)
Element.prototype.scrollIntoView = vi.fn();

describe('ChunkPackStoryPage', () => {
  const mockStoryData = {
    stories: [
      {
        id: 'story-1',
        title: 'A Day at the Office',
        storyText: 'Full story text here...',
        english: 'Full English translation here...',
        audioUrl: 'https://storage.example.com/story-audio.mp3',
        segments: [
          {
            id: 'seg-1',
            order: 1,
            japaneseText: '田中さん：おはようございます！',
            englishTranslation: 'Tanaka: Good morning!',
            startTime: 0,
            endTime: 2000,
          },
          {
            id: 'seg-2',
            order: 2,
            japaneseText: '山田さん：おはようございます。今日はいい天気ですね。',
            englishTranslation: "Yamada: Good morning. Nice weather today, isn't it?",
            startTime: 2000,
            endTime: 5000,
          },
        ],
      },
    ],
  };

  const renderPage = () =>
    render(
      <BrowserRouter>
        <ChunkPackStoryPage />
      </BrowserRouter>
    );

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve(mockStoryData),
    });
  });

  describe('loading state', () => {
    it('should show loading spinner initially', () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => {}));

      renderPage();
      // eslint-disable-next-line testing-library/no-node-access
      const loader = document.querySelector('.animate-spin');
      expect(loader).toBeInTheDocument();
    });
  });

  describe('rendering after load', () => {
    it('should render the page header', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Step 2: Story')).toBeInTheDocument();
      });
    });

    it('should render story title', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('A Day at the Office')).toBeInTheDocument();
      });
    });

    it('should render speaker names in legend', async () => {
      renderPage();

      await waitFor(() => {
        // Speaker names appear in both legend and segments
        expect(screen.getAllByText('田中さん').length).toBeGreaterThan(0);
        expect(screen.getAllByText('山田さん').length).toBeGreaterThan(0);
      });
    });

    it('should render segment text', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('おはようございます！')).toBeInTheDocument();
        expect(screen.getByText('おはようございます。今日はいい天気ですね。')).toBeInTheDocument();
      });
    });

    it('should render segment numbers', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument();
        expect(screen.getByText('#2')).toBeInTheDocument();
      });
    });
  });

  describe('audio player', () => {
    it('should render audio player when story has audio', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('audio-player')).toBeInTheDocument();
      });
    });
  });

  describe('English translation toggle', () => {
    it('should render Show English button by default', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Show English')).toBeInTheDocument();
      });
    });

    it('should toggle to Hide English when clicked', async () => {
      renderPage();

      const toggleButton = await screen.findByText('Show English');
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByText('Hide English')).toBeInTheDocument();
      });
    });

    it('should show English translations when toggled on', async () => {
      renderPage();

      const toggleButton = await screen.findByText('Show English');
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByText('Good morning!')).toBeInTheDocument();
      });
    });
  });

  describe('navigation', () => {
    it('should render Back button', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Back')).toBeInTheDocument();
      });
    });

    it('should render Next: Exercises button', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Next: Exercises')).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('should show message when no story exists', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: () => Promise.resolve({ stories: [] }),
      });

      renderPage();

      await waitFor(() => {
        expect(
          screen.getByText('Story generation is not yet implemented for this pack.')
        ).toBeInTheDocument();
      });
    });

    it('should show Continue to Exercises button when no story', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: () => Promise.resolve({ stories: [] }),
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Continue to Exercises')).toBeInTheDocument();
      });
    });
  });

  describe('API calls', () => {
    it('should fetch story data on mount', async () => {
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
        expect(consoleSpy).toHaveBeenCalledWith('Failed to load story:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });

    it('should show empty state on fetch error', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      renderPage();

      await waitFor(() => {
        expect(
          screen.getByText('Story generation is not yet implemented for this pack.')
        ).toBeInTheDocument();
      });
    });
  });
});
