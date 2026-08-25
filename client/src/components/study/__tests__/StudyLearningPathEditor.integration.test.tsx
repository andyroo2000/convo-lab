import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { StudyCardSummary } from '@languageflow/shared/src/types';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CSRF_TOKEN_COOKIE_NAME } from '../../../lib/csrf';
import { render, screen } from '../../../test/utils';
import StudyLearningPathEditor from '../StudyLearningPathEditor';

const currentCard: StudyCardSummary = {
  id: '01arz3ndektsv4rrffq69g5fav',
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
  id: '01arz3ndektsv4rrffq69g5faw',
  noteId: 'note-successor',
  prompt: { cueText: '会社' },
  answer: { expression: '会社', meaning: 'company' },
};

const canonicalCard = (card: StudyCardSummary, stage: number, status: 'available' | 'locked') => ({
  id: card.id,
  source_note_id: card.noteId,
  front_text: card.prompt.cueText,
  back_text: card.answer.meaning,
  card_type: card.cardType,
  prompt_json: { cue_text: card.prompt.cueText },
  answer_json: { expression: card.answer.expression, meaning: card.answer.meaning },
  variant_stage: stage,
  variant_status: status,
});

describe('StudyLearningPathEditor query integration', () => {
  beforeEach(() => {
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=learning-path-test-token; path=/`;
  });

  afterEach(() => {
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    vi.unstubAllGlobals();
  });

  it('keeps the success confirmation visible after the query cache advances the tail', async () => {
    let linked = false;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === '/sanctum/csrf-cookie') {
          document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=learning-path-test-token; path=/`;
          return { ok: true, status: 204 } as Response;
        }
        if (url.startsWith('/api/study/cards?')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ items: [successorCard], limit: 20, nextCursor: null }),
          } as Response;
        }
        if (
          url === `/api/cards/${currentCard.id}/learning-path/successor` &&
          init?.method === 'PUT'
        ) {
          linked = true;
        }
        if (url === `/api/cards/${currentCard.id}/learning-path` || linked) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                group_id: linked ? '01arz3ndektsv4rrffq69g5fax' : null,
                anchor_card_id: currentCard.id,
                stages: linked
                  ? [
                      {
                        number: 1,
                        cards: [canonicalCard(currentCard, 1, 'available')],
                      },
                      {
                        number: 2,
                        cards: [canonicalCard(successorCard, 2, 'locked')],
                      },
                    ]
                  : [],
              },
            }),
          } as Response;
        }
        throw new Error(`Unexpected request: ${url}`);
      })
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <StudyLearningPathEditor card={currentCard} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await screen.findByText(
      'This card is not in a path yet. Choose what it should unlock to start one.'
    );
    await userEvent.type(screen.getByLabelText('Search for the next card'), '会社');
    await userEvent.click(screen.getByRole('button', { name: 'Find card' }));
    await userEvent.click(await screen.findByRole('button', { name: /会社 company/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Add next stage' }));

    expect(
      await screen.findByText(
        'Next stage added. It will unlock after a successful review of the current stage.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Paths grow from their final stage.')).toBeInTheDocument();
    expect(screen.queryByText('What should this card unlock?')).not.toBeInTheDocument();
  });
});
