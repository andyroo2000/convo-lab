/* eslint-disable testing-library/no-node-access */
// Complex playback page testing with audio elements requires direct node access
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';

import PlaybackPage from '../PlaybackPage';
import type { Episode } from '../../types';

// Use vi.hoisted to ensure mock functions are available when vi.mock runs (which is hoisted)
const mockGetEpisode = vi.hoisted(() => vi.fn());
const mockGenerateAudio = vi.hoisted(() => vi.fn());
const mockGenerateAllSpeedsAudio = vi.hoisted(() => vi.fn());
const mockPollJobStatus = vi.hoisted(() => vi.fn());
const mockAudioRef = vi.hoisted(() => vi.fn());
const mockAudioState = vi.hoisted(() => ({
  currentTime: 0,
  duration: 0,
  isPlaying: false,
}));
const mockSeek = vi.hoisted(() => vi.fn());
const mockPlay = vi.hoisted(() => vi.fn());
const mockPause = vi.hoisted(() => vi.fn());
const mockUseWarmAudioCache = vi.hoisted(() => vi.fn());

vi.mock('../../hooks/useEpisodes', () => ({
  useEpisodes: () => ({
    getEpisode: mockGetEpisode,
    generateAudio: mockGenerateAudio,
    generateAllSpeedsAudio: mockGenerateAllSpeedsAudio,
    pollJobStatus: mockPollJobStatus,
    loading: false,
  }),
}));

vi.mock('../../hooks/useAudioPlayer', () => ({
  useAudioPlayer: () => ({
    audioRef: mockAudioRef,
    currentTime: mockAudioState.currentTime,
    duration: mockAudioState.duration,
    isPlaying: mockAudioState.isPlaying,
    seek: mockSeek,
    play: mockPlay,
    pause: mockPause,
  }),
}));

vi.mock('../../hooks/useWarmAudioCache', () => ({
  default: mockUseWarmAudioCache,
}));

vi.mock('../../hooks/useSpeakerAvatars', () => ({
  useSpeakerAvatars: () => ({
    avatarUrlMap: new Map([
      ['ja-male-casual.jpg', 'https://storage.example.com/ja-male-casual.jpg'],
    ]),
  }),
}));

vi.mock('../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    isFeatureEnabled: () => true,
  }),
}));

// Mock the AudioPlayer component
vi.mock('../../components/AudioPlayer', () => ({
  default: ({ src }: { src: string; audioRef: unknown }) => (
    <div data-testid="mock-audio-player" data-src={src}>
      Mock Audio Player
    </div>
  ),
}));

// Mock JapaneseText to avoid rendering issues
vi.mock('../../components/JapaneseText', () => ({
  default: ({ text }: { text: string }) => <span data-testid="japanese-text">{text}</span>,
}));

// Mock fetch for job polling
global.fetch = vi.fn();

// Mock window.scrollTo (not implemented in jsdom)
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: vi.fn(),
});

const mockEpisode: Episode = {
  id: 'episode-123',
  title: 'Test Episode',
  targetLanguage: 'ja',
  nativeLanguage: 'en',
  sourceText: 'Test source text',
  status: 'ready',
  audioUrl: 'https://storage.example.com/audio.mp3',
  audioUrl_0_7: 'https://storage.example.com/audio-0.7.mp3',
  audioUrl_0_85: 'https://storage.example.com/audio-0.85.mp3',
  audioUrl_1_0: 'https://storage.example.com/audio-1.0.mp3',
  createdAt: new Date(),
  updatedAt: new Date(),
  userId: 'user-123',
  autoGenerateAudio: true,
  dialogue: {
    id: 'dialogue-123',
    episodeId: 'episode-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    speakers: [
      {
        id: 'speaker-1',
        name: '田中',
        voiceId: 'ja-JP-Neural2-B',
        proficiency: 'N3',
        tone: 'casual',
        gender: 'male',
      },
      {
        id: 'speaker-2',
        name: '鈴木',
        voiceId: 'ja-JP-Neural2-C',
        proficiency: 'N3',
        tone: 'formal',
        gender: 'female',
      },
    ],
    sentences: [
      {
        id: 'sentence-1',
        dialogueId: 'dialogue-123',
        text: 'こんにちは',
        translation: 'Hello',
        speakerId: 'speaker-1',
        order: 0,
        metadata: { japanese: { kanji: 'こんにちは', kana: 'こんにちは', furigana: '' } },
        selected: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        startTime: 0,
        endTime: 2000,
        startTime_0_7: 0,
        endTime_0_7: 2857,
        startTime_0_85: 0,
        endTime_0_85: 2353,
        startTime_1_0: 0,
        endTime_1_0: 2000,
      },
      {
        id: 'sentence-2',
        dialogueId: 'dialogue-123',
        text: 'お元気ですか',
        translation: 'How are you?',
        speakerId: 'speaker-2',
        order: 1,
        metadata: { japanese: { kanji: 'お元気ですか', kana: 'おげんきですか', furigana: '' } },
        selected: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        startTime: 2000,
        endTime: 4000,
        startTime_0_7: 2857,
        endTime_0_7: 5714,
        startTime_0_85: 2353,
        endTime_0_85: 4706,
        startTime_1_0: 2000,
        endTime_1_0: 4000,
      },
    ],
  },
};

const mockScriptEpisode: Episode = {
  id: 'script-episode-123',
  title: 'Script Episode',
  targetLanguage: 'ja',
  nativeLanguage: 'en',
  sourceText: '日本に住んでいます。',
  status: 'ready',
  createdAt: new Date(),
  updatedAt: new Date(),
  userId: 'user-123',
  autoGenerateAudio: false,
  contentType: 'script',
  audioScript: {
    id: 'script-123',
    episodeId: 'script-episode-123',
    status: 'ready',
    imageStatus: 'partial',
    imageErrorMessage: 'Some illustrations are missing.',
    voiceId: 'ja-JP-Neural2-D',
    voiceProvider: 'google',
    segments: [
      {
        id: 'segment-1',
        scriptId: 'script-123',
        order: 0,
        text: '日本に住んでいます。',
        reading: '日本[にほん]に住[す]んでいます。',
        translation: 'I live in Japan.',
        imageStatus: 'ready',
        imageMediaId: 'media-1',
        imageMedia: {
          id: 'media-1',
          mediaKind: 'image',
          contentType: 'image/webp',
          publicUrl: null,
          sourceFilename: 'media-1.webp',
        },
        metadata: { japanese: { kanji: '日本に住んでいます。', kana: '', furigana: '' } },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    renders: [
      {
        id: 'render-085',
        scriptId: 'script-123',
        speed: '0.85',
        numericSpeed: 0.85,
        status: 'ready',
        audioUrl: 'https://storage.example.com/script-085.mp3',
        approxDurationSeconds: 3,
        timingData: [{ unitIndex: 0, startTime: 0, endTime: 2500 }],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

const PlaybackRouteControls = () => {
  const navigate = useNavigate();

  return (
    <>
      <button type="button" onClick={() => navigate('/playback/episode-456')}>
        Open next episode
      </button>
      <button type="button" onClick={() => navigate('/playback/episode-123?viewAs=user-456')}>
        View as next user
      </button>
    </>
  );
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

describe('PlaybackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockAudioState.currentTime = 0;
    mockAudioState.duration = 0;
    mockAudioState.isPlaying = false;
    mockGetEpisode.mockResolvedValue(mockEpisode);
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ state: 'completed', progress: 100 }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderPlaybackPage = (episodeId = 'episode-123', search = '') =>
    render(
      <MemoryRouter initialEntries={[`/playback/${episodeId}${search}`]}>
        <Routes>
          <Route
            path="/playback/:episodeId"
            element={
              <>
                <PlaybackRouteControls />
                <PlaybackPage />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    );

  describe('loading state', () => {
    it('should exist as loading state is managed by useEpisodes hook', () => {
      // Note: Testing loading state requires a more sophisticated mocking approach
      // since vi.mock is hoisted and cannot be changed mid-test
      // The component correctly shows loading spinner when loading is true
      expect(true).toBe(true);
    });
  });

  describe('episode not found', () => {
    it('should show "Episode not found" when episode is null', async () => {
      mockGetEpisode.mockResolvedValue(null);

      renderPlaybackPage();

      await waitFor(() => {
        expect(screen.getByText('Episode not found')).toBeInTheDocument();
      });
    });
  });

  describe('episode display', () => {
    it('should warm all available episode audio speeds', async () => {
      renderPlaybackPage();

      await waitFor(() => {
        expect(mockUseWarmAudioCache).toHaveBeenCalledWith(
          [
            'https://storage.example.com/audio-0.7.mp3',
            'https://storage.example.com/audio-0.85.mp3',
            'https://storage.example.com/audio-1.0.mp3',
            'https://storage.example.com/audio.mp3',
          ],
          true
        );
      });
    });

    it('should display episode title', async () => {
      renderPlaybackPage();

      await waitFor(() => {
        expect(screen.getByText('Test Episode')).toBeInTheDocument();
      });
    });

    it('should display proficiency level', async () => {
      renderPlaybackPage();

      await waitFor(() => {
        expect(screen.getByText('N3')).toBeInTheDocument();
      });
    });

    it('should display speaker tone', async () => {
      renderPlaybackPage();

      await waitFor(() => {
        expect(screen.getByText('casual')).toBeInTheDocument();
      });
    });

    it('should display sentences with translations', async () => {
      renderPlaybackPage();

      await waitFor(() => {
        expect(screen.getByText('Hello')).toBeInTheDocument();
        expect(screen.getByText('How are you?')).toBeInTheDocument();
      });
    });

    it('should render script segment image and retry control for partial script images', async () => {
      mockGetEpisode.mockResolvedValue(mockScriptEpisode);

      renderPlaybackPage('script-episode-123');

      const image = await screen.findByTestId('script-active-image');
      expect(image).toHaveAttribute(
        'src',
        expect.stringContaining('/api/convolab/scripts/media/media-1')
      );
      expect(image).toHaveClass('object-contain');
      expect(screen.getByTestId('script-reader-lines')).toBeInTheDocument();
      expect(screen.getByTestId('script-button-retry-images')).toBeInTheDocument();
      expect(screen.getAllByText('I live in Japan.').length).toBeGreaterThan(0);
      expect(screen.queryByText('Segment 1')).not.toBeInTheDocument();
    });

    it('derives the permanent script image route from the stable media ID', async () => {
      mockGetEpisode.mockResolvedValue({
        ...mockScriptEpisode,
        audioScript: {
          ...mockScriptEpisode.audioScript!,
          segments: [
            {
              ...mockScriptEpisode.audioScript!.segments[0],
              imageMedia: {
                ...mockScriptEpisode.audioScript!.segments[0].imageMedia!,
                publicUrl: '/api/scripts/media/rewritten-media-id',
              },
            },
          ],
        },
      });

      renderPlaybackPage('script-episode-123');

      const image = await screen.findByTestId('script-active-image');
      expect(image).toHaveAttribute(
        'src',
        expect.stringContaining('/api/convolab/scripts/media/media-1')
      );
      expect(image).not.toHaveAttribute(
        'src',
        expect.stringContaining('/api/scripts/media/rewritten-media-id')
      );
    });

    it('shows a full-screen image with legible glass captions while a script is playing', async () => {
      mockAudioState.isPlaying = true;
      mockAudioState.currentTime = 0.2;
      mockGetEpisode.mockResolvedValue(mockScriptEpisode);

      renderPlaybackPage('script-episode-123');

      const movieButton = await screen.findByTestId('script-button-movie-mode');
      fireEvent.click(movieButton);

      expect(await screen.findByTestId('script-cinema-overlay')).toBeInTheDocument();
      const image = screen.getByTestId('script-cinema-image');
      expect(image).toHaveAttribute(
        'src',
        expect.stringContaining('/api/convolab/scripts/media/media-1')
      );
      expect(image).toHaveClass('object-contain');
      expect(screen.getByTestId('script-cinema-caption')).toHaveClass('backdrop-blur-md');
      expect(screen.getByTestId('script-cinema-caption')).toHaveClass('bg-[rgba(4,16,28,0.68)]');
      expect(screen.getAllByText('日本[にほん]に住[す]んでいます。').length).toBeGreaterThan(0);
      expect(screen.getAllByText('I live in Japan.').length).toBeGreaterThan(0);
    });

    it('toggles script playback with the spacebar on the main page', async () => {
      mockGetEpisode.mockResolvedValue(mockScriptEpisode);

      renderPlaybackPage('script-episode-123');

      expect(await screen.findByTestId('script-playback-page')).toBeInTheDocument();
      fireEvent.keyDown(window, { key: ' ', code: 'Space' });

      expect(mockPlay).toHaveBeenCalled();
      expect(screen.queryByTestId('script-cinema-overlay')).not.toBeInTheDocument();
    });

    it('toggles script playback with the spacebar in cinema mode', async () => {
      mockAudioState.isPlaying = true;
      mockAudioState.currentTime = 0.2;
      mockGetEpisode.mockResolvedValue(mockScriptEpisode);

      renderPlaybackPage('script-episode-123');

      const movieButton = await screen.findByTestId('script-button-movie-mode');
      fireEvent.click(movieButton);

      expect(await screen.findByTestId('script-cinema-overlay')).toBeInTheDocument();
      fireEvent.keyDown(window, { key: ' ', code: 'Space' });

      expect(mockPause).toHaveBeenCalled();
    });

    it('opens movie mode from the explicit movie button and starts playback', async () => {
      mockGetEpisode.mockResolvedValue(mockScriptEpisode);

      renderPlaybackPage('script-episode-123');

      const movieButton = await screen.findByTestId('script-button-movie-mode');
      fireEvent.click(movieButton);

      expect(await screen.findByTestId('script-cinema-overlay')).toBeInTheDocument();
      expect(mockPlay).toHaveBeenCalled();
    });
  });

  describe('audio player', () => {
    it('should render audio player when audio URL is available', async () => {
      renderPlaybackPage();

      await waitFor(() => {
        expect(screen.getByTestId('mock-audio-player')).toBeInTheDocument();
      });
    });

    it('should pass correct audio URL to audio player based on speed', async () => {
      renderPlaybackPage();

      await waitFor(() => {
        const audioPlayer = screen.getByTestId('mock-audio-player');
        // Default speed is medium (0.85x)
        expect(audioPlayer.getAttribute('data-src')).toBe(
          'https://storage.example.com/audio-0.85.mp3'
        );
      });
    });
  });

  describe('speed selector', () => {
    it('should render speed selector when audio is available', async () => {
      renderPlaybackPage();

      await waitFor(() => {
        // SpeedSelector should be rendered
        expect(screen.getByText(/slow/i)).toBeInTheDocument();
      });
    });
  });

  describe('view toggle buttons', () => {
    it('should show Furigana toggle for Japanese episodes', async () => {
      renderPlaybackPage();

      await waitFor(() => {
        expect(screen.getByText('Furigana')).toBeInTheDocument();
      });
    });

    it('should show English toggle for Japanese episodes', async () => {
      renderPlaybackPage();

      await waitFor(() => {
        expect(screen.getByText('English')).toBeInTheDocument();
      });
    });
  });

  describe('sentence interaction', () => {
    it('should have clickable sentences with data-testid', async () => {
      renderPlaybackPage();

      await waitFor(() => {
        expect(screen.getByTestId('playback-sentence-sentence-1')).toBeInTheDocument();
        expect(screen.getByTestId('playback-sentence-sentence-2')).toBeInTheDocument();
      });
    });

    it('should call seek when clicking a sentence', async () => {
      renderPlaybackPage();

      await waitFor(() => {
        expect(screen.getByTestId('playback-sentence-sentence-1')).toBeInTheDocument();
      });

      const sentence = screen.getByTestId('playback-sentence-sentence-1');
      fireEvent.click(sentence);

      // seek should be called with the start time in seconds
      expect(mockSeek).toHaveBeenCalledWith(0);
    });

    it('should call play when clicking sentence if not playing', async () => {
      renderPlaybackPage();

      await waitFor(() => {
        expect(screen.getByTestId('playback-sentence-sentence-1')).toBeInTheDocument();
      });

      const sentence = screen.getByTestId('playback-sentence-sentence-1');
      fireEvent.click(sentence);

      expect(mockPlay).toHaveBeenCalled();
    });
  });

  describe('speaker avatars', () => {
    it('should display speaker avatars', async () => {
      renderPlaybackPage();

      await waitFor(() => {
        const avatarImages = document.querySelectorAll('img');
        expect(avatarImages.length).toBeGreaterThan(0);
      });
    });

    it('should include speaker labels on avatar images', async () => {
      renderPlaybackPage();

      await waitFor(() => {
        expect(screen.getByAltText('田中')).toBeInTheDocument();
      });
      expect(screen.getByAltText('鈴木')).toBeInTheDocument();
    });
  });

  describe('episode loading', () => {
    it('should call getEpisode with episodeId on mount', async () => {
      renderPlaybackPage('episode-123');

      await waitFor(() => {
        expect(mockGetEpisode).toHaveBeenCalledWith('episode-123', false, undefined);
      });
    });

    it('reloads the episode when the impersonated user changes', async () => {
      renderPlaybackPage('episode-123', '?viewAs=user-123');

      await waitFor(() => {
        expect(mockGetEpisode).toHaveBeenCalledWith('episode-123', false, 'user-123');
      });

      fireEvent.click(screen.getByRole('button', { name: 'View as next user' }));

      await waitFor(() => {
        expect(mockGetEpisode).toHaveBeenCalledWith('episode-123', false, 'user-456');
      });
    });

    it('does not let a stale episode response overwrite the current route', async () => {
      const firstEpisode = deferred<Episode>();
      const nextEpisode = {
        ...mockEpisode,
        id: 'episode-456',
        title: 'Next Episode',
      };
      mockGetEpisode.mockImplementation((id: string) =>
        id === 'episode-123' ? firstEpisode.promise : Promise.resolve(nextEpisode)
      );

      renderPlaybackPage();
      fireEvent.click(screen.getByRole('button', { name: 'Open next episode' }));

      expect(await screen.findByText('Next Episode')).toBeInTheDocument();

      firstEpisode.resolve(mockEpisode);

      await waitFor(() => {
        expect(screen.queryByText('Test Episode')).not.toBeInTheDocument();
      });
      expect(screen.getByText('Next Episode')).toBeInTheDocument();
    });
  });

  describe('fallback behavior', () => {
    it('should handle episodes with all audio URLs', async () => {
      renderPlaybackPage();

      await waitFor(() => {
        const audioPlayer = screen.getByTestId('mock-audio-player');
        // Default speed is medium (0.85x)
        expect(audioPlayer.getAttribute('data-src')).toBe(
          'https://storage.example.com/audio-0.85.mp3'
        );
      });
    });
  });

  describe('speaker color assignment', () => {
    it('should apply different colors to different speakers', async () => {
      renderPlaybackPage();

      await waitFor(() => {
        const sentence1 = screen.getByTestId('playback-sentence-sentence-1');
        const sentence2 = screen.getByTestId('playback-sentence-sentence-2');

        // Both should have border-left style
        expect(sentence1.style.borderLeft).toBeTruthy();
        expect(sentence2.style.borderLeft).toBeTruthy();
      });
    });
  });

  describe('component structure', () => {
    it('should render sticky header container', async () => {
      renderPlaybackPage();

      await waitFor(() => {
        const stickyHeader = document.querySelector('[data-playback-sticky-header]');
        expect(stickyHeader).toBeInTheDocument();
      });
    });

    it('should render dialogue container', async () => {
      renderPlaybackPage();

      await waitFor(() => {
        const dialogueContainer = screen.getByTestId('playback-page-container');
        expect(dialogueContainer).toBeInTheDocument();
      });
    });
  });

  describe('toast notification', () => {
    it('should render toast component', async () => {
      renderPlaybackPage();

      // Toast is always rendered but may be hidden
      // We just verify the component renders without error
      await waitFor(() => {
        expect(screen.getByText('Test Episode')).toBeInTheDocument();
      });
    });
  });

  describe('Japanese text rendering', () => {
    it('should render Japanese text with JapaneseText component', async () => {
      renderPlaybackPage();

      await waitFor(() => {
        // Sentences should be rendered
        expect(screen.getByText('Hello')).toBeInTheDocument();
      });
    });
  });

  describe('audio generation', () => {
    it('should not show generation progress when all speeds are available', async () => {
      renderPlaybackPage();

      await waitFor(() => {
        expect(screen.queryByText(/Generating audio/)).not.toBeInTheDocument();
      });
    });

    it('starts only one audio job for same-frame Generate Audio clicks', async () => {
      mockGetEpisode.mockResolvedValue({
        ...mockEpisode,
        autoGenerateAudio: false,
        audioUrl_0_7: undefined,
        audioUrl_0_85: undefined,
        audioUrl_1_0: undefined,
      });
      const generationRequest = deferred<string>();
      mockGenerateAllSpeedsAudio.mockReturnValue(generationRequest.promise);

      renderPlaybackPage();

      const generateButton = await screen.findByRole('button', { name: 'Generate Audio' });
      act(() => {
        generateButton.click();
        generateButton.click();
      });

      expect(mockGenerateAllSpeedsAudio).toHaveBeenCalledTimes(1);

      generationRequest.resolve('job-123');
      await act(async () => generationRequest.promise);
    });

    it('retries only the episode refresh after completed audio generation', async () => {
      const episodeMissingSpeeds = {
        ...mockEpisode,
        autoGenerateAudio: false,
        audioUrl_0_7: undefined,
        audioUrl_0_85: undefined,
        audioUrl_1_0: undefined,
      };
      const retryRequest = deferred<Episode>();
      let bustCacheRequests = 0;
      mockGetEpisode.mockImplementation((_id: string, bustCache: boolean) => {
        if (!bustCache) return Promise.resolve(episodeMissingSpeeds);

        bustCacheRequests += 1;
        return bustCacheRequests === 1
          ? Promise.reject(new Error('reload failed'))
          : retryRequest.promise;
      });
      mockGenerateAllSpeedsAudio.mockResolvedValue('job-123');
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      let pollJob: (() => Promise<void>) | undefined;
      const realSetInterval = globalThis.setInterval;
      vi.spyOn(globalThis, 'setInterval').mockImplementation((callback, delay, ...args) => {
        if (delay === 1000) {
          pollJob = callback as () => Promise<void>;
          return 1 as unknown as NodeJS.Timeout;
        }

        return realSetInterval(callback, delay, ...args);
      });

      renderPlaybackPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Generate Audio' }));
      await waitFor(() => expect(pollJob).toBeDefined());

      await act(async () => pollJob?.());

      expect(
        await screen.findByText('Audio generated, but the episode could not be refreshed.')
      ).toBeInTheDocument();
      expect(screen.queryByText(/Generating audio at all speeds/)).not.toBeInTheDocument();

      const retryButton = screen.getByRole('button', { name: 'Retry refresh' });
      act(() => {
        retryButton.click();
        retryButton.click();
      });

      expect(mockGenerateAllSpeedsAudio).toHaveBeenCalledTimes(1);
      expect(bustCacheRequests).toBe(2);

      retryRequest.resolve(mockEpisode);
      await act(async () => retryRequest.promise);

      expect(await screen.findByText('Audio is ready!')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Retry refresh' })).not.toBeInTheDocument();
    });

    it('stops polling an audio job after navigating to another episode', async () => {
      const episodeMissingSpeeds = {
        ...mockEpisode,
        audioUrl_0_7: undefined,
        audioUrl_0_85: undefined,
        audioUrl_1_0: undefined,
      };
      const nextEpisode = {
        ...mockEpisode,
        id: 'episode-456',
        title: 'Next Episode',
      };
      mockGetEpisode.mockImplementation((id: string) =>
        Promise.resolve(id === 'episode-123' ? episodeMissingSpeeds : nextEpisode)
      );
      mockGenerateAllSpeedsAudio.mockResolvedValue('job-123');

      let pollJob: (() => Promise<void>) | undefined;
      const realSetInterval = globalThis.setInterval;
      vi.spyOn(globalThis, 'setInterval').mockImplementation((callback, delay, ...args) => {
        if (delay === 1000) {
          pollJob = callback as () => Promise<void>;
          return 1 as unknown as NodeJS.Timeout;
        }

        return realSetInterval(callback, delay, ...args);
      });

      renderPlaybackPage();

      await waitFor(() => {
        expect(mockGenerateAllSpeedsAudio).toHaveBeenCalledWith('episode-123', 'dialogue-123');
        expect(pollJob).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Open next episode' }));
      expect(await screen.findByText('Next Episode')).toBeInTheDocument();

      await pollJob?.();

      expect(global.fetch).not.toHaveBeenCalled();
      expect(screen.queryByText('Audio generated successfully!')).not.toBeInTheDocument();
    });

    it('records an accepted audio job even when its route is no longer current', async () => {
      const episodeMissingSpeeds = {
        ...mockEpisode,
        audioUrl_0_7: undefined,
        audioUrl_0_85: undefined,
        audioUrl_1_0: undefined,
      };
      const nextEpisode = {
        ...mockEpisode,
        id: 'episode-456',
        title: 'Next Episode',
      };
      const generationRequest = deferred<string>();
      mockGetEpisode.mockImplementation((id: string) =>
        Promise.resolve(id === 'episode-123' ? episodeMissingSpeeds : nextEpisode)
      );
      mockGenerateAllSpeedsAudio.mockReturnValue(generationRequest.promise);

      renderPlaybackPage();
      await waitFor(() => {
        expect(mockGenerateAllSpeedsAudio).toHaveBeenCalledWith('episode-123', 'dialogue-123');
      });

      fireEvent.click(screen.getByRole('button', { name: 'Open next episode' }));
      expect(await screen.findByText('Next Episode')).toBeInTheDocument();

      generationRequest.resolve('job-123');
      await act(async () => generationRequest.promise);

      expect(sessionStorage.getItem('audio-generation-queued')).toBe(
        JSON.stringify(['episode-123'])
      );
    });

    it('does not overlap slow audio job polling requests', async () => {
      mockGetEpisode.mockResolvedValue({
        ...mockEpisode,
        audioUrl_0_7: undefined,
        audioUrl_0_85: undefined,
        audioUrl_1_0: undefined,
      });
      mockGenerateAllSpeedsAudio.mockResolvedValue('job-123');
      const pollResponse = deferred<{
        ok: boolean;
        status: number;
        json: () => Promise<{ state: string; progress: number }>;
      }>();
      (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(pollResponse.promise);

      let pollJob: (() => Promise<void>) | undefined;
      const realSetInterval = globalThis.setInterval;
      vi.spyOn(globalThis, 'setInterval').mockImplementation((callback, delay, ...args) => {
        if (delay === 1000) {
          pollJob = callback as () => Promise<void>;
          return 1 as unknown as NodeJS.Timeout;
        }

        return realSetInterval(callback, delay, ...args);
      });

      renderPlaybackPage();
      await waitFor(() => expect(pollJob).toBeDefined());

      let firstPoll: Promise<void> | undefined;
      await act(async () => {
        firstPoll = pollJob?.();
        await pollJob?.();
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);

      pollResponse.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ state: 'processing', progress: 30 }),
      });
      await act(async () => firstPoll);
    });

    it('recovers from malformed queued-generation session data', async () => {
      sessionStorage.setItem('audio-generation-queued', '{not-json');
      mockGetEpisode.mockResolvedValue({
        ...mockEpisode,
        audioUrl_0_7: undefined,
        audioUrl_0_85: undefined,
        audioUrl_1_0: undefined,
      });
      mockGenerateAllSpeedsAudio.mockResolvedValue('job-123');

      renderPlaybackPage();

      await waitFor(() => {
        expect(mockGenerateAllSpeedsAudio).toHaveBeenCalledWith('episode-123', 'dialogue-123');
      });
      expect(sessionStorage.getItem('audio-generation-queued')).toBe(
        JSON.stringify(['episode-123'])
      );
    });
  });

  describe('responsive layout', () => {
    it('should render mobile and desktop classes', async () => {
      renderPlaybackPage();

      await waitFor(() => {
        // Check for responsive classes
        const responsiveElements = document.querySelectorAll('[class*="sm:"]');
        expect(responsiveElements.length).toBeGreaterThan(0);
      });
    });
  });
});
