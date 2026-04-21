import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import StudyHistoryPage from '../StudyHistoryPage';

const { useStudyCardOptionsMock, useStudyHistoryMock } = vi.hoisted(() => ({
  useStudyCardOptionsMock: vi.fn(),
  useStudyHistoryMock: vi.fn(),
}));

vi.mock('../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    isFeatureEnabled: () => true,
  }),
}));

vi.mock('../../hooks/useStudy', () => ({
  useStudyCardOptions: (enabled: boolean, limit: number) => useStudyCardOptionsMock(enabled, limit),
  useStudyHistory: (enabled: boolean, cardId?: string) => useStudyHistoryMock(enabled, cardId),
}));

describe('StudyHistoryPage', () => {
  beforeEach(() => {
    useStudyCardOptionsMock.mockReset();
    useStudyHistoryMock.mockReset();

    useStudyCardOptionsMock.mockReturnValue({
      data: {
        total: 125,
        options: [{ id: 'card-1', label: '会社' }],
      },
      isLoading: false,
      error: null,
    });
    useStudyHistoryMock.mockReturnValue({
      data: [
        {
          id: 'history-1',
          cardId: 'card-1',
          source: 'anki_import',
          reviewedAt: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          rating: 'good',
          sourceReviewId: '1775915610000',
        },
      ],
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
    expect(screen.getByRole('option', { name: '会社' })).toBeInTheDocument();
    expect(
      screen.getByText('Showing first 1 of 125 cards in the filter dropdown.')
    ).toBeInTheDocument();
    expect(screen.getByText('anki_import')).toBeInTheDocument();
  });
});
