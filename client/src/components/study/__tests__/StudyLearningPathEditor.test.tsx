import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, waitFor } from '../../../test/utils';
import StudyLearningPathEditor from '../StudyLearningPathEditor';

const studyMocks = vi.hoisted(() => ({
  getStudyCards: vi.fn(),
  mutateAsync: vi.fn(),
  refetch: vi.fn(),
  pathQuery: {
    data: undefined as unknown,
    error: null as Error | null,
    isError: false,
    isPending: false,
  },
}));

vi.mock('../../../hooks/useStudy', () => ({
  getStudyCards: studyMocks.getStudyCards,
  useStudyLearningPath: () => ({
    ...studyMocks.pathQuery,
    refetch: studyMocks.refetch,
  }),
  useLinkStudyLearningPathSuccessor: () => ({
    error: null,
    isError: false,
    isPending: false,
    mutateAsync: studyMocks.mutateAsync,
  }),
}));

const currentCard = {
  id: 'card-current',
  noteId: null,
  cardType: 'recognition' as const,
  prompt: { cueText: '会社を辞めました。' },
  answer: { expression: '会社を辞めました。', meaning: 'I left the company.' },
  state: { dueAt: null, queueState: 'new' as const, scheduler: null, source: {} },
  answerAudioSource: 'missing' as const,
  createdAt: '2026-08-25T00:00:00.000Z',
  updatedAt: '2026-08-25T00:00:00.000Z',
};

const successorCard = {
  ...currentCard,
  id: 'card-successor',
  noteId: 'note-successor',
  prompt: { cueText: '会社' },
  answer: { expression: '会社', meaning: 'company' },
};

const renderEditor = () =>
  render(
    <MemoryRouter>
      <StudyLearningPathEditor card={currentCard} />
    </MemoryRouter>
  );

describe('StudyLearningPathEditor', () => {
  beforeEach(() => {
    studyMocks.getStudyCards.mockReset();
    studyMocks.mutateAsync.mockReset();
    studyMocks.refetch.mockReset();
    studyMocks.pathQuery.data = {
      groupId: null,
      anchorCardId: currentCard.id,
      stages: [],
    };
    studyMocks.pathQuery.error = null;
    studyMocks.pathQuery.isError = false;
    studyMocks.pathQuery.isPending = false;
  });

  it('searches existing cards and confirms the next stage before linking it', async () => {
    studyMocks.getStudyCards.mockResolvedValue({
      items: [currentCard, successorCard],
      limit: 20,
      nextCursor: null,
    });
    studyMocks.mutateAsync.mockResolvedValue({
      groupId: 'group-1',
      anchorCardId: currentCard.id,
      stages: [],
    });
    renderEditor();

    expect(
      screen.getByText('This card is not in a path yet. Choose what it should unlock to start one.')
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Search for the next card'), '会社');
    await userEvent.click(screen.getByRole('button', { name: 'Find card' }));

    expect(await screen.findByRole('button', { name: /会社 company/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /会社を辞めました/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /会社 company/ }));

    expect(
      screen.getByText('Unlock “会社” after “会社を辞めました。” reaches Guru.')
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add next stage' }));

    await waitFor(() => {
      expect(studyMocks.mutateAsync).toHaveBeenCalledWith({
        cardId: currentCard.id,
        successorCardId: successorCard.id,
        unlockRequirement: 'guru',
      });
    });
    expect(
      screen.getByText('Next stage added with the selected unlock requirement.')
    ).toBeInTheDocument();
  });

  it('directs authors to the final card when the selected card is not the path tail', () => {
    studyMocks.pathQuery.data = {
      groupId: 'group-1',
      anchorCardId: currentCard.id,
      stages: [
        {
          number: 1,
          cards: [
            {
              id: currentCard.id,
              noteId: null,
              cardType: 'recognition',
              displayText: '会社を辞めました。',
              meaning: 'I left the company.',
              variantStage: 1,
              variantStatus: 'available',
              unlockRequirement: null,
            },
          ],
        },
        {
          number: 2,
          cards: [
            {
              id: successorCard.id,
              noteId: successorCard.noteId,
              cardType: 'recognition',
              displayText: '会社',
              meaning: 'company',
              variantStage: 2,
              variantStatus: 'locked',
              unlockRequirement: 'guru',
            },
          ],
        },
      ],
    };
    renderEditor();

    expect(screen.getByText('Stage 1')).toBeInTheDocument();
    expect(screen.getByText('Stage 2')).toBeInTheDocument();
    expect(screen.queryByText('What should this card unlock?')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Edit “会社” to add the next stage.' })
    ).toHaveAttribute('href', '/app/study/browse?cardId=card-successor&noteId=note-successor');
  });

  it('defaults cloze successors to Master', async () => {
    const clozeSuccessor = {
      ...successorCard,
      id: 'card-cloze-successor',
      cardType: 'cloze' as const,
    };
    studyMocks.getStudyCards.mockResolvedValue({
      items: [clozeSuccessor],
      limit: 20,
      nextCursor: null,
    });
    renderEditor();

    await userEvent.type(screen.getByLabelText('Search for the next card'), '会社');
    await userEvent.click(screen.getByRole('button', { name: 'Find card' }));
    await userEvent.click(await screen.findByRole('button', { name: /会社 company/ }));

    expect(screen.getByLabelText('Unlock next stage when current stage reaches')).toHaveValue(
      'master'
    );
  });
});
