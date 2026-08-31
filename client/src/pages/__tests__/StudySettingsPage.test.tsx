import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import StudySettingsPage from '../StudySettingsPage';
import studyCapabilitiesFixture from '../../test/studyCapabilitiesFixture';

const {
  updateStudySettingsMock,
  useStudySettingsMock,
  knownKanjiQueryData,
  setManualKnownKanjiMock,
} = vi.hoisted(() => ({
  updateStudySettingsMock: vi.fn(),
  useStudySettingsMock: vi.fn(),
  knownKanjiQueryData: {
    current: {
      version: 1,
      kanji: [] as string[],
      manualKanji: [] as string[],
      wanikani: { connected: false, lastSyncedAt: null },
    },
  },
  setManualKnownKanjiMock: vi.fn(),
}));

vi.mock('../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    isFeatureEnabled: () => true,
  }),
}));

vi.mock('../../hooks/useStudyCapabilities', () => ({
  useStudyCapabilities: () => ({ data: studyCapabilitiesFixture }),
}));

vi.mock('../../hooks/useKnownKanji', () => ({
  useKnownKanji: () => ({
    data: knownKanjiQueryData.current,
    enabled: true,
    error: null,
    isLoading: false,
    isSuccess: true,
  }),
  useConnectWaniKani: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDisconnectWaniKani: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSyncWaniKani: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetManualKnownKanji: () => ({
    mutateAsync: setManualKnownKanjiMock,
    isPending: false,
  }),
}));

vi.mock('../../hooks/useStudyBackgroundTask', () => ({
  default:
    () =>
    (
      task?: Promise<unknown> | (() => Promise<unknown> | unknown),
      options?: { onError?: (message: string) => void }
    ) => {
      if (typeof task === 'function') {
        Promise.resolve(task()).catch((error) => {
          options?.onError?.(error instanceof Error ? error.message : 'Request failed.');
        });
      } else {
        Promise.resolve(task).catch((error) => {
          options?.onError?.(error instanceof Error ? error.message : 'Request failed.');
        });
      }
    },
}));

vi.mock('../../hooks/useStudy', () => ({
  useStudySettings: (...args: unknown[]) => useStudySettingsMock(...args),
  useUpdateStudySettings: () => ({
    mutateAsync: updateStudySettingsMock,
    isPending: false,
    isSuccess: false,
  }),
}));

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <StudySettingsPage />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('StudySettingsPage', () => {
  beforeEach(() => {
    updateStudySettingsMock.mockReset();
    setManualKnownKanjiMock.mockReset();
    knownKanjiQueryData.current = {
      version: 1,
      kanji: [],
      manualKanji: [],
      wanikani: { connected: false, lastSyncedAt: null },
    };
    useStudySettingsMock.mockReturnValue({
      data: {
        newCardsPerDay: 20,
        newCardLaneWeights: { standard: 3, lessonFollowup: 1, wanikani: 1 },
      },
      isLoading: false,
      error: null,
    });
  });

  it('renders study controls without the card queue', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /study settings/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/new cards per day/i)).toHaveValue(20);
    expect(screen.queryByTestId('study-new-queue-row')).not.toBeInTheDocument();
  });

  it('adds an obvious manual known-kanji override', async () => {
    renderPage();

    await userEvent.type(screen.getByLabelText('Known kanji'), '私');
    await userEvent.click(screen.getByRole('button', { name: 'Add kanji' }));

    await waitFor(() => {
      expect(setManualKnownKanjiMock).toHaveBeenCalledWith({ kanji: '私', known: true });
    });
  });

  it('removes a manual known-kanji override through settings', async () => {
    knownKanjiQueryData.current = {
      version: 2,
      kanji: ['私'],
      manualKanji: ['私'],
      wanikani: { connected: false, lastSyncedAt: null },
    };
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Remove manual override for 私' }));

    await waitFor(() => {
      expect(setManualKnownKanjiMock).toHaveBeenCalledWith({ kanji: '私', known: false });
    });
  });

  it('shows a localized settings load error', () => {
    useStudySettingsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Settings endpoint failed'),
    });

    renderPage();

    expect(screen.getByText(/failed to load study settings/i)).toBeInTheDocument();
    expect(screen.queryByText(/settings endpoint failed/i)).not.toBeInTheDocument();
  });

  it('saves the daily new-card limit', async () => {
    const user = userEvent.setup();
    updateStudySettingsMock.mockResolvedValue({ newCardsPerDay: 12 });
    renderPage();

    const input = screen.getByLabelText(/new cards per day/i);
    await user.clear(input);
    await user.type(input, '12');
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() =>
      expect(updateStudySettingsMock).toHaveBeenCalledWith({
        lessonBatchSize: 5,
        newCardsPerDay: 12,
        newCardLaneWeights: { standard: 3, lessonFollowup: 1, wanikani: 1 },
      })
    );
  });

  it('saves API-provided lane weights and explains their proportions', async () => {
    const user = userEvent.setup();
    updateStudySettingsMock.mockResolvedValue({ newCardsPerDay: 20 });
    renderPage();

    expect(screen.getByLabelText('Standard queue')).toHaveValue(3);
    expect(screen.getAllByText('20%')).toHaveLength(2);

    const waniKaniWeight = screen.getByLabelText('WaniKani');
    await user.clear(waniKaniWeight);
    await user.type(waniKaniWeight, '2');
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() =>
      expect(updateStudySettingsMock).toHaveBeenCalledWith({
        lessonBatchSize: 5,
        newCardsPerDay: 20,
        newCardLaneWeights: { standard: 3, lessonFollowup: 1, wanikani: 2 },
      })
    );
  });

  it('does not invent lane values when an older settings response omits them', async () => {
    updateStudySettingsMock.mockResolvedValue({ newCardsPerDay: 20 });
    useStudySettingsMock.mockReturnValue({
      data: { newCardsPerDay: 20 },
      isLoading: false,
      error: null,
    });
    renderPage();

    expect(screen.queryByLabelText('Standard queue')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() =>
      expect(updateStudySettingsMock).toHaveBeenCalledWith({
        lessonBatchSize: 5,
        newCardsPerDay: 20,
      })
    );
  });

  it('shows localized feedback when saving the daily limit fails', async () => {
    updateStudySettingsMock.mockRejectedValue(new Error('Save endpoint failed'));
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

    expect(await screen.findByText(/failed to save study settings/i)).toBeInTheDocument();
    expect(screen.queryByText(/save endpoint failed/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/new cards per day/i), { target: { value: '12' } });
    expect(screen.queryByText(/failed to save study settings/i)).not.toBeInTheDocument();
  });

  it('clears and auto-dismisses the saved settings confirmation', async () => {
    vi.useFakeTimers();
    updateStudySettingsMock.mockResolvedValue({ newCardsPerDay: 12 });

    try {
      renderPage();

      const input = screen.getByLabelText(/new cards per day/i);
      fireEvent.change(input, { target: { value: '12' } });
      fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByText(/saved/i)).toBeInTheDocument();

      fireEvent.change(input, { target: { value: '13' } });
      expect(screen.queryByText(/saved/i)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /save settings/i }));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByText(/saved/i)).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(screen.queryByText(/saved/i)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
