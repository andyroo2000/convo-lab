import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import StudySettingsPage from '../StudySettingsPage';

const {
  updateStudySettingsMock,
  reorderStudyNewCardQueueMock,
  useStudySettingsMock,
  useStudyNewCardQueueMock,
} = vi.hoisted(() => ({
  updateStudySettingsMock: vi.fn(),
  reorderStudyNewCardQueueMock: vi.fn(),
  useStudySettingsMock: vi.fn(),
  useStudyNewCardQueueMock: vi.fn(),
}));

vi.mock('../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    isFeatureEnabled: () => true,
  }),
}));

vi.mock('../../hooks/useStudyBackgroundTask', () => ({
  default: () => (task?: Promise<unknown> | (() => Promise<unknown> | unknown)) => {
    if (typeof task === 'function') {
      Promise.resolve(task()).catch(() => undefined);
    } else {
      Promise.resolve(task).catch(() => undefined);
    }
  },
}));

vi.mock('../../hooks/useStudy', () => ({
  getStudyNewCardQueue: vi.fn(),
  useStudySettings: (...args: unknown[]) => useStudySettingsMock(...args),
  useStudyNewCardQueue: (...args: unknown[]) => useStudyNewCardQueueMock(...args),
  useUpdateStudySettings: () => ({
    mutateAsync: updateStudySettingsMock,
    isPending: false,
    isSuccess: false,
  }),
  useReorderStudyNewCardQueue: () => ({
    mutateAsync: reorderStudyNewCardQueueMock,
    isPending: false,
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
    reorderStudyNewCardQueueMock.mockReset();
    useStudySettingsMock.mockReturnValue({
      data: { newCardsPerDay: 20 },
      isLoading: false,
      error: null,
    });
    useStudyNewCardQueueMock.mockReturnValue({
      data: {
        items: [
          {
            id: 'card-1',
            noteId: 'note-1',
            cardType: 'recognition',
            displayText: '会社',
            meaning: 'company',
            queuePosition: 1,
            createdAt: new Date('2026-04-01T00:00:00.000Z').toISOString(),
            updatedAt: new Date('2026-04-01T00:00:00.000Z').toISOString(),
          },
          {
            id: 'card-2',
            noteId: 'note-2',
            cardType: 'production',
            displayText: '学校',
            meaning: 'school',
            queuePosition: 2,
            createdAt: new Date('2026-04-01T00:00:00.000Z').toISOString(),
            updatedAt: new Date('2026-04-01T00:00:00.000Z').toISOString(),
          },
        ],
        total: 2,
        limit: 100,
        nextCursor: null,
      },
      isLoading: false,
      error: null,
    });
  });

  it('renders the daily limit and new-card queue rows', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /study settings/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/new cards per day/i)).toHaveValue(20);
    expect(screen.getByText('会社')).toBeInTheDocument();
    expect(screen.getByText('学校')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reorder 会社/i })).toBeInTheDocument();
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
      expect(updateStudySettingsMock).toHaveBeenCalledWith({ newCardsPerDay: 12 })
    );
  });
});
