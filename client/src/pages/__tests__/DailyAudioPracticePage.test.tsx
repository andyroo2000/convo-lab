import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DailyAudioPracticePage from '../DailyAudioPracticePage';
import type { DailyAudioPractice } from '../../types';
import studyCapabilitiesFixture from '../../test/studyCapabilitiesFixture';

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
    status: (id: string) => ['daily-audio-practice', 'status', id],
    detail: (id: string) => ['daily-audio-practice', 'detail', id],
  },
  useRecentDailyAudioPractice: mockUseRecentDailyAudioPractice,
  useDailyAudioPractice: mockUseDailyAudioPractice,
  useDailyAudioPracticeStatus: mockUseDailyAudioPracticeStatus,
  useCreateDailyAudioPractice: mockUseCreateDailyAudioPractice,
}));

vi.mock('../../hooks/useStudyCapabilities', () => ({
  useStudyCapabilities: () => ({ data: studyCapabilitiesFixture }),
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
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute('open');
    };
    vi.clearAllMocks();
    mockUseRecentDailyAudioPractice.mockReturnValue({
      data: [],
      isLoading: false,
      isSuccess: true,
    });
    mockUseDailyAudioPractice.mockReturnValue({ data: undefined, isLoading: false });
    mockUseDailyAudioPracticeStatus.mockReturnValue({ data: undefined });
    mockUseCreateDailyAudioPractice.mockReturnValue({
      mutateAsync: mockCreateMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    });
  });

  function openCreator() {
    fireEvent.click(screen.getByRole('button', { name: 'New audio drill' }));
  }
  it('opens the duration picker and generates only on explicit confirmation', async () => {
    mockCreateMutateAsync.mockResolvedValue(readyPractice);
    renderPage();
    expect(screen.getByText('Create your first audio drill to start listening.')).toBeVisible();
    openCreator();
    fireEvent.click(screen.getByRole('button', { name: '45 min' }));
    expect(mockCreateMutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Generate 45-min drill' }));
    await waitFor(() => expect(mockCreateMutateAsync).toHaveBeenCalledWith(45));
  });
  it('cancels without creating a drill', () => {
    renderPage();
    openCreator();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mockCreateMutateAsync).not.toHaveBeenCalled();
  });
  it('loads the newest playable long drill, skips legacy short tracks and supports older recordings', () => {
    const earlier = { ...readyPractice, id: 'older', practiceDate: '2026-04-03' };
    const shortOnly = {
      ...readyPractice,
      id: 'short',
      practiceDate: '2026-06-06',
      tracks: readyPractice.tracks.slice(1),
    };
    mockUseRecentDailyAudioPractice.mockReturnValue({ data: [earlier, shortOnly, readyPractice] });
    renderPage();
    expect(screen.getAllByTestId('script-track-player')).toHaveLength(1);
    expect(mockUseDailyAudioPractice).toHaveBeenCalledWith(readyPractice.id);
    fireEvent.change(screen.getByRole('combobox', { name: 'Recording date' }), {
      target: { value: 'older' },
    });
    expect(mockUseDailyAudioPractice).toHaveBeenLastCalledWith('older');
  });
  it('explicitly confirms before replacing a same-day recording', async () => {
    mockUseRecentDailyAudioPractice.mockReturnValue({
      data: [{ ...readyPractice, practiceDate: todayPracticeDate() }],
    });
    mockCreateMutateAsync.mockResolvedValue(readyPractice);
    renderPage();
    openCreator();
    fireEvent.click(screen.getByRole('button', { name: /Generate .*min drill/ }));
    expect(mockCreateMutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Replace recording' }));
    await waitFor(() => expect(mockCreateMutateAsync).toHaveBeenCalledTimes(1));
  });
  it('keeps the last recording available and polls an active generation', () => {
    const pending = {
      ...readyPractice,
      id: 'pending',
      practiceDate: todayPracticeDate(),
      updatedAt: new Date().toISOString(),
      status: 'generating',
      tracks: [],
    };
    mockUseRecentDailyAudioPractice.mockReturnValue({ data: [pending, readyPractice] });
    mockUseDailyAudioPracticeStatus.mockReturnValue({
      data: { status: 'generating', progress: 24 },
    });
    renderPage();
    expect(mockUseDailyAudioPracticeStatus).toHaveBeenCalledWith('pending', true);
    expect(screen.getByRole('button', { name: 'New audio drill' })).toBeDisabled();
    expect(screen.getByRole('progressbar', { name: 'Recording your drill…' })).toHaveAttribute(
      'value',
      '24'
    );
    expect(screen.getByText(/24%/)).toBeVisible();
    expect(screen.getByTestId('script-track-player')).toBeVisible();
  });
  it('enables retry once the current generation crosses its stale threshold', () => {
    vi.useFakeTimers();
    try {
      const pending = {
        ...readyPractice,
        id: 'pending',
        practiceDate: todayPracticeDate(),
        updatedAt: new Date(Date.now() - 90 * 60000 + 5000).toISOString(),
        status: 'generating',
        tracks: [],
      };
      mockUseRecentDailyAudioPractice.mockReturnValue({ data: [pending] });
      renderPage();
      expect(screen.getByRole('button', { name: 'New audio drill' })).toBeDisabled();
      act(() => vi.advanceTimersByTime(6000));
      expect(screen.getByRole('button', { name: 'New audio drill' })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });
  it('surfaces generation and create errors with a path to retry', () => {
    mockUseRecentDailyAudioPractice.mockReturnValue({
      data: [
        {
          ...readyPractice,
          practiceDate: todayPracticeDate(),
          status: 'error',
          errorMessage: 'No eligible cards',
          tracks: [],
        },
      ],
    });
    mockUseCreateDailyAudioPractice.mockReturnValue({
      isError: true,
      error: new Error('Try again later'),
    });
    renderPage();
    expect(screen.getByText('No eligible cards')).toBeVisible();
    expect(screen.getByText('Try again later')).toBeVisible();
    expect(screen.getByRole('button', { name: 'New audio drill' })).toBeEnabled();
  });
});
