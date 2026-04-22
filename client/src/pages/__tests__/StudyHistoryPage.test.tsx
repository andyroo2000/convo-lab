import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import StudyHistoryPage from '../StudyHistoryPage';

const { useStudyCardOptionsMock, useStudyHistoryPageMock } = vi.hoisted(() => ({
  useStudyCardOptionsMock: vi.fn(),
  useStudyHistoryPageMock: vi.fn(),
}));

vi.mock('../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    isFeatureEnabled: () => true,
  }),
}));

vi.mock('../../hooks/useStudy', () => ({
  useStudyCardOptions: (enabled: boolean, limit: number) => useStudyCardOptionsMock(enabled, limit),
  useStudyHistoryPage: (
    enabled: boolean,
    params: { cardId?: string; cursor?: string; limit?: number }
  ) => useStudyHistoryPageMock(enabled, params),
}));

describe('StudyHistoryPage', () => {
  beforeEach(() => {
    useStudyCardOptionsMock.mockReset();
    useStudyHistoryPageMock.mockReset();

    useStudyCardOptionsMock.mockReturnValue({
      data: {
        total: 125,
        options: [{ id: 'card-1', label: '会社' }],
      },
      isLoading: false,
      error: null,
    });
    useStudyHistoryPageMock.mockReturnValue({
      data: {
        events: [
          {
            id: 'history-1',
            cardId: 'card-1',
            source: 'anki_import',
            reviewedAt: new Date('2026-04-12T00:00:00.000Z').toISOString(),
            rating: 'good',
            sourceReviewId: '1775915610000',
          },
        ],
        nextCursor: null,
      },
      isLoading: false,
      error: null,
    });
  });

  it('loads card options through the lightweight selector query and shows truncation details', () => {
    render(
      <BrowserRouter>
        <StudyHistoryPage />
      </BrowserRouter>
    );

    expect(useStudyCardOptionsMock).toHaveBeenCalledWith(true, 100);
    expect(useStudyHistoryPageMock).toHaveBeenCalledWith(true, {
      cardId: undefined,
      cursor: undefined,
      limit: 50,
    });
    expect(screen.getByRole('option', { name: '会社' })).toBeInTheDocument();
    expect(
      screen.getByText('Showing first 1 of 125 cards in the filter dropdown.')
    ).toBeInTheDocument();
    expect(screen.getByText('anki_import')).toBeInTheDocument();
  });

  it('appends additional history events when Load more is clicked', async () => {
    const initialPage = {
      events: [
        {
          id: 'history-1',
          cardId: 'card-1',
          source: 'anki_import',
          reviewedAt: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          rating: 'good',
          sourceReviewId: '1775915610000',
        },
      ],
      nextCursor: 'cursor-2',
    };
    const nextPage = {
      events: [
        {
          id: 'history-2',
          cardId: 'card-1',
          source: 'convolab',
          reviewedAt: new Date('2026-04-13T00:00:00.000Z').toISOString(),
          rating: 'again',
        },
      ],
      nextCursor: null,
    };

    useStudyHistoryPageMock.mockImplementation(
      (_enabled: boolean, params: { cardId?: string; cursor?: string; limit?: number }) => ({
        data: params.cursor === 'cursor-2' ? nextPage : initialPage,
        isLoading: false,
        error: null,
      })
    );

    render(
      <BrowserRouter>
        <StudyHistoryPage />
      </BrowserRouter>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    await waitFor(() => {
      expect(useStudyHistoryPageMock).toHaveBeenCalledWith(true, {
        cardId: undefined,
        cursor: 'cursor-2',
        limit: 50,
      });
    });

    expect(screen.getByText('anki_import')).toBeInTheDocument();
    expect(screen.getByText('convolab')).toBeInTheDocument();
  });
});
