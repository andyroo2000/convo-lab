import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import StudyCreatePage from '../StudyCreatePage';

const { createStudyCardMock } = vi.hoisted(() => ({
  createStudyCardMock: vi.fn(),
}));

vi.mock('../../hooks/useStudy', () => ({
  useCreateStudyCard: () => ({
    mutateAsync: createStudyCardMock,
    isPending: false,
    error: null,
  }),
}));

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <StudyCreatePage />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('StudyCreatePage', () => {
  beforeEach(() => {
    createStudyCardMock.mockReset();
    createStudyCardMock.mockResolvedValue({ cardType: 'recognition' });
  });

  it('creates a recognition card and shows a success message', async () => {
    renderPage();

    await userEvent.type(screen.getByLabelText('Prompt text'), '会社');
    await userEvent.type(screen.getByLabelText('Answer expression'), '会社');
    await userEvent.type(screen.getByLabelText('Answer meaning'), 'company');
    await userEvent.click(screen.getByRole('button', { name: 'Create card' }));

    expect(createStudyCardMock).toHaveBeenCalledWith({
      cardType: 'recognition',
      prompt: {
        cueText: '会社',
        cueReading: null,
        cueMeaning: null,
      },
      answer: {
        expression: '会社',
        expressionReading: null,
        meaning: 'company',
        sentenceJp: null,
        sentenceEn: null,
        notes: null,
      },
    });
    expect(
      await screen.findByText('Created recognition card and seeded it into the study queue.')
    ).toBeInTheDocument();
  });
});
