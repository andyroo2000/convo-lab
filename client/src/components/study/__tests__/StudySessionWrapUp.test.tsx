import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { StudyCardSummary } from '@languageflow/shared/src/types';

import StudySessionWrapUp from '../StudySessionWrapUp';

const presentationCard = (overrides: { label: string | null; meaning: string | null }) =>
  ({
    id: `card-${overrides.label ?? 'null'}`,
    noteId: null,
    cardType: 'recognition',
    prompt: { cueText: 'raw prompt', cueMeaning: 'raw prompt meaning' },
    answer: { expression: 'raw answer', meaning: 'raw answer meaning' },
    presentation: {
      version: 1,
      front: {
        mode: 'text',
        text: overrides.label,
        ruby: null,
        hint: null,
        media: { audio: null, image: null },
        autoplayAudio: false,
      },
      answer: {
        heading: null,
        ruby: null,
        restored: null,
        meaning: overrides.meaning,
        sentences: {
          japanese: { text: null, ruby: null },
          english: { text: null, ruby: null },
        },
        notes: [],
        media: { image: null },
        audio: null,
        pitchAccent: null,
      },
    },
    state: { dueAt: null, queueState: 'review', scheduler: null, source: {} },
    answerAudioSource: 'missing',
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
  }) as StudyCardSummary;

describe('StudySessionWrapUp', () => {
  it('uses known-v1 labels and meanings without resurrecting explicit-null raw fields', () => {
    const serverCard = presentationCard({
      label: ' server label ',
      meaning: ' server meaning ',
    });
    const nullCard = presentationCard({ label: '   ', meaning: '   ' });

    render(
      <StudySessionWrapUp
        summary={{
          reviewsCompleted: 2,
          firstPassRecall: 1,
          stabilizedCards: [nullCard],
          toughestCards: [{ card: serverCard, missCount: 1, durationMs: 2_000 }],
          burnedCountChange: 0,
        }}
        caughtUp
        achievements={[]}
        isFinalizing={false}
        onPractice={vi.fn()}
        onDone={vi.fn()}
      />
    );

    expect(screen.getByText('server label')).toBeInTheDocument();
    expect(screen.getByText('server meaning')).toBeInTheDocument();
    expect(screen.queryByText('raw answer')).not.toBeInTheDocument();
    expect(screen.queryByText('raw answer meaning')).not.toBeInTheDocument();
    expect(screen.queryByText('raw prompt')).not.toBeInTheDocument();
    expect(screen.queryByText('raw prompt meaning')).not.toBeInTheDocument();
  });
});
