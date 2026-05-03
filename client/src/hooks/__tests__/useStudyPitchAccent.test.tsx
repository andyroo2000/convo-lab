import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StudyCardSummary } from '@languageflow/shared/src/types';
import { createWrapper } from '../../__tests__/hooks/test-utils';
import useStudyPitchAccent from '../useStudyPitchAccent';

const { resolveStudyCardPitchAccentMock } = vi.hoisted(() => ({
  resolveStudyCardPitchAccentMock: vi.fn(),
}));

vi.mock('../useStudy', () => ({
  resolveStudyCardPitchAccent: resolveStudyCardPitchAccentMock,
}));

function buildCard(id: string): StudyCardSummary {
  return {
    id,
    noteId: `note-${id}`,
    cardType: 'recognition',
    prompt: { cueText: '会社', cueReading: 'かいしゃ' },
    answer: { expression: '会社', expressionReading: '会社[かいしゃ]', meaning: 'company' },
    state: {
      dueAt: '2026-04-12T00:00:00.000Z',
      queueState: 'review',
      scheduler: null,
      source: {},
    },
    answerAudioSource: 'missing',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-12T00:00:00.000Z',
  };
}

describe('useStudyPitchAccent', () => {
  beforeEach(() => {
    resolveStudyCardPitchAccentMock.mockReset();
  });

  it('fetches the next card after a previous pitch accent request fails', async () => {
    resolveStudyCardPitchAccentMock
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({
        ...buildCard('card-2'),
        answer: {
          ...buildCard('card-2').answer,
          pitchAccent: {
            status: 'resolved',
            expression: '会社',
            reading: 'かいしゃ',
            pitchNum: 0,
            morae: ['か', 'い', 'しゃ'],
            pattern: [0, 1, 1],
            patternName: '平板',
            source: 'kanjium',
            resolvedBy: 'local-reading',
          },
        },
      });

    const { rerender } = renderHook(({ card }) => useStudyPitchAccent(card, true), {
      initialProps: { card: buildCard('card-1') },
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(resolveStudyCardPitchAccentMock).toHaveBeenCalledWith('card-1', expect.any(Object));
    });

    rerender({ card: buildCard('card-2') });

    await waitFor(() => {
      expect(resolveStudyCardPitchAccentMock).toHaveBeenCalledWith('card-2', expect.any(Object));
    });
  });
});
