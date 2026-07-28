import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DailyAudioPracticePage from '../DailyAudioPracticePage';
import type { DailyAudioPractice } from '../../types';

const {
  mockUseRecentDailyAudioPractice,
  mockUseDailyAudioPractice,
  mockUseDailyAudioPracticeStatus,
  mockUseCreateDailyAudioPractice,
  mockCreateMutateAsync,
} = vi.hoisted(() => ({
  mockUseRecentDailyAudioPractice: vi.fn(),
  mockUseDailyAudioPractice: vi.fn(),
  mockUseDailyAudioPracticeStatus: vi.fn(),
  mockUseCreateDailyAudioPractice: vi.fn(),
  mockCreateMutateAsync: vi.fn(),
}));

vi.mock('../../hooks/useDailyAudioPractice', () => ({
  dailyAudioPracticeKeys: {
    list: () => ['daily-audio-practice', 'list'],
    detail: (id: string) => ['daily-audio-practice', 'detail', id],
  },
  useRecentDailyAudioPractice: mockUseRecentDailyAudioPractice,
  useDailyAudioPractice: mockUseDailyAudioPractice,
  useDailyAudioPracticeStatus: mockUseDailyAudioPracticeStatus,
  useCreateDailyAudioPractice: mockUseCreateDailyAudioPractice,
}));

vi.mock('../../components/audio/ScriptTrackPlayer', () => ({
  default: ({ title }: { title: string }) => <div data-testid="script-track-player">{title}</div>,
}));

const readyPractice: DailyAudioPractice = {
  id: 'practice-1',
  userId: 'user-1',
  practiceDate: '2026-05-05',
  status: 'ready',
  targetDurationMinutes: 30,
  targetLanguage: 'ja',
  nativeLanguage: 'en',
  sourceCardIdsJson: ['card-1', 'card-2', 'card-3'],
  selectionSummaryJson: {
    totalCandidates: 12,
    totalEligible: 10,
    selectedCount: 3,
    dueCount: 2,
    learningCount: 1,
    recentMissCount: 1,
  },
  errorMessage: null,
  createdAt: '2026-05-05T12:00:00.000Z',
  updatedAt: '2026-05-05T12:00:00.000Z',
  tracks: [
    {
      id: 'track-drill',
      practiceId: 'practice-1',
      mode: 'drill',
      status: 'ready',
      title: 'Drills',
      sortOrder: 0,
      scriptUnitsJson: [],
      audioUrl: '/drill.mp3',
      timingData: [],
      approxDurationSeconds: 600,
      generationMetadataJson: null,
      errorMessage: null,
      createdAt: '2026-05-05T12:00:00.000Z',
      updatedAt: '2026-05-05T12:00:00.000Z',
    },
    {
      id: 'track-dialogue',
      practiceId: 'practice-1',
      mode: 'dialogue',
      status: 'ready',
      title: 'Dialogues',
      sortOrder: 1,
      scriptUnitsJson: [],
      audioUrl: '/dialogue.mp3',
      timingData: [],
      approxDurationSeconds: 600,
      generationMetadataJson: null,
      errorMessage: null,
      createdAt: '2026-05-05T12:00:00.000Z',
      updatedAt: '2026-05-05T12:00:00.000Z',
    },
    {
      id: 'track-story',
      practiceId: 'practice-1',
      mode: 'story',
      status: 'ready',
      title: 'Story',
      sortOrder: 2,
      scriptUnitsJson: [],
      audioUrl: '/story.mp3',
      timingData: [],
      approxDurationSeconds: 600,
      generationMetadataJson: null,
      errorMessage: null,
      createdAt: '2026-05-05T12:00:00.000Z',
      updatedAt: '2026-05-05T12:00:00.000Z',
    },
  ],
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DailyAudioPracticePage />
    </QueryClientProvider>
  );
}

function todayPracticeDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

describe('DailyAudioPracticePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRecentDailyAudioPractice.mockReturnValue({ data: [], isLoading: false });
    mockUseDailyAudioPractice.mockReturnValue({ data: undefined, isLoading: false });
    mockUseDailyAudioPracticeStatus.mockReturnValue({ data: undefined });
    mockUseCreateDailyAudioPractice.mockReturnValue({
      mutateAsync: mockCreateMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    });
  });

  it("shows an empty state and creates today's practice set", async () => {
    mockCreateMutateAsync.mockResolvedValue(readyPractice);

    renderPage();

    expect(screen.getByText('Ready when you are')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /generate today's audio/i }));

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledTimes(1);
    });
  });

  it("confirms before overwriting today's existing audio", async () => {
    const todayPractice = { ...readyPractice, practiceDate: todayPracticeDate() };
    mockUseRecentDailyAudioPractice.mockReturnValue({
      data: [todayPractice],
      isLoading: false,
    });
    mockUseDailyAudioPractice.mockReturnValue({ data: todayPractice, isLoading: false });
    mockCreateMutateAsync.mockResolvedValue(todayPractice);

    renderPage();

    expect(
      screen.getByText(
        'Generate audio drills based on words and grammar structures you are currently working on.'
      )
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /regenerate today's audio/i }));

    expect(screen.getByText('Regenerate today’s audio?')).toBeInTheDocument();
    expect(screen.getByText(/overwrite today’s existing audio drills/i)).toBeInTheDocument();
    expect(mockCreateMutateAsync).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Keep Existing Audio' }));
    expect(screen.queryByText('Regenerate today’s audio?')).not.toBeInTheDocument();
    expect(mockCreateMutateAsync).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /regenerate today's audio/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate Audio' }));

    await waitFor(() => expect(mockCreateMutateAsync).toHaveBeenCalledTimes(1));
  });

  it('retries a failed practice without showing an overwrite warning', async () => {
    const failedPractice = {
      ...readyPractice,
      practiceDate: todayPracticeDate(),
      status: 'error' as const,
    };
    mockUseRecentDailyAudioPractice.mockReturnValue({ data: [failedPractice], isLoading: false });
    mockUseDailyAudioPractice.mockReturnValue({ data: failedPractice, isLoading: false });
    mockCreateMutateAsync.mockResolvedValue(readyPractice);

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /generate today's audio/i }));

    expect(screen.queryByText('Regenerate today’s audio?')).not.toBeInTheDocument();
    await waitFor(() => expect(mockCreateMutateAsync).toHaveBeenCalledTimes(1));
  });

  it('swipes between earlier and later days without moving beyond the latest day', () => {
    const earlierPractice = {
      ...readyPractice,
      id: 'practice-earlier',
      practiceDate: '2026-05-04',
    };
    const practices = [readyPractice, earlierPractice];
    mockUseRecentDailyAudioPractice.mockReturnValue({ data: practices, isLoading: false });
    mockUseDailyAudioPractice.mockImplementation((id: string | undefined) => ({
      data: practices.find((item) => item.id === id),
      isLoading: false,
    }));

    renderPage();
    const swipeRegion = screen.getByTestId('daily-audio-day');

    fireEvent.touchStart(swipeRegion, { touches: [{ clientX: 100, clientY: 20 }] });
    fireEvent.touchEnd(swipeRegion, { changedTouches: [{ clientX: 180, clientY: 20 }] });
    expect(screen.getByText('2026-05-04')).toBeInTheDocument();

    fireEvent.touchStart(swipeRegion, { touches: [{ clientX: 100, clientY: 20 }] });
    fireEvent.touchEnd(swipeRegion, { changedTouches: [{ clientX: 180, clientY: 20 }] });
    expect(screen.getByText('2026-05-04')).toBeInTheDocument();

    fireEvent.touchStart(swipeRegion, { touches: [{ clientX: 180, clientY: 20 }] });
    fireEvent.touchEnd(swipeRegion, { changedTouches: [{ clientX: 100, clientY: 20 }] });
    expect(screen.getByText('2026-05-05')).toBeInTheDocument();

    fireEvent.touchStart(swipeRegion, { touches: [{ clientX: 180, clientY: 20 }] });
    fireEvent.touchEnd(swipeRegion, { changedTouches: [{ clientX: 100, clientY: 20 }] });
    expect(screen.getByText('2026-05-05')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Earlier day' }));
    expect(screen.getByText('2026-05-04')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Later day' }));
    expect(screen.getByText('2026-05-05')).toBeInTheDocument();
  });

  it('shows generation progress and track statuses', () => {
    mockUseRecentDailyAudioPractice.mockReturnValue({
      data: [{ ...readyPractice, status: 'generating' }],
      isLoading: false,
    });
    mockUseDailyAudioPractice.mockReturnValue({
      data: { ...readyPractice, status: 'generating' },
      isLoading: false,
    });
    mockUseDailyAudioPracticeStatus.mockReturnValue({
      data: { id: 'practice-1', status: 'generating', progress: 45, tracks: [] },
    });

    renderPage();

    expect(screen.getByText("Generating today's tracks")).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
    expect(screen.getByText(/Drills: Ready/)).toBeInTheDocument();
  });

  it('renders source summary and all three ready tracks', () => {
    mockUseRecentDailyAudioPractice.mockReturnValue({ data: [readyPractice], isLoading: false });
    mockUseDailyAudioPractice.mockReturnValue({ data: readyPractice, isLoading: false });

    renderPage();

    expect(screen.getByText('2026-05-05')).toBeInTheDocument();
    expect(screen.getByText('Cards')).toBeInTheDocument();
    expect(screen.getAllByTestId('script-track-player')).toHaveLength(3);
    expect(screen.getByText('Drills')).toBeInTheDocument();
    expect(screen.getByText('Dialogues')).toBeInTheDocument();
    expect(screen.getByText('Story')).toBeInTheDocument();
  });

  it('shows a generation error', () => {
    const errorPractice = {
      ...readyPractice,
      status: 'error' as const,
      errorMessage: 'No eligible study cards found for daily audio practice.',
    };
    mockUseRecentDailyAudioPractice.mockReturnValue({ data: [errorPractice], isLoading: false });
    mockUseDailyAudioPractice.mockReturnValue({ data: errorPractice, isLoading: false });

    renderPage();

    expect(screen.getByText('Generation failed')).toBeInTheDocument();
    expect(
      screen.getByText('No eligible study cards found for daily audio practice.')
    ).toBeInTheDocument();
  });

  it('surfaces create errors without throwing from the click handler', async () => {
    mockUseCreateDailyAudioPractice.mockReturnValue({
      mutateAsync: mockCreateMutateAsync,
      isPending: false,
      isError: true,
      error: new Error('No eligible cards.'),
    });
    mockCreateMutateAsync.mockRejectedValue(new Error('No eligible cards.'));

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /generate today's audio/i }));

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText('Could not start practice')).toBeInTheDocument();
    expect(screen.getByText('No eligible cards.')).toBeInTheDocument();
  });
});
