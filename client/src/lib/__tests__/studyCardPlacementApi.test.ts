import { describe, expect, it, vi } from 'vitest';
import { requestJson } from '../apiClient';
import {
  assignStudyCardSource,
  creationPlacementPayload,
  setStudyCardLearnSoon,
} from '../studyCardPlacementApi';

vi.mock('../apiClient', () => ({ requestJson: vi.fn() }));

describe('card source and priority writes', () => {
  it('assigns and clears sources using canonical card IDs without scheduling fields', async () => {
    const source = { pileId: 'book', chapterId: 'chapter', position: 3, reference: 'p. 25' };
    await assignStudyCardSource('card', source);
    expect(requestJson).toHaveBeenLastCalledWith('/api/study/card-sources', {
      method: 'PUT',
      body: JSON.stringify({ cardIds: ['card'], bookSource: source }),
    });
    await assignStudyCardSource('card', null);
    expect(requestJson).toHaveBeenLastCalledWith('/api/study/card-sources', {
      method: 'PUT',
      body: JSON.stringify({ cardIds: ['card'], bookSource: null }),
    });
  });
  it('clears priority explicitly while leaving source and lane untouched', async () => {
    await setStudyCardLearnSoon('card', false);
    expect(requestJson).toHaveBeenLastCalledWith('/api/study/learn-soon', {
      method: 'PUT',
      body: JSON.stringify({ cardIds: ['card'], learnSoon: false }),
    });
  });
  it('keeps source and urgency independent when creating drafts or vocab families', () => {
    expect(creationPlacementPayload(null, false)).toEqual({});
    expect(creationPlacementPayload(null, true)).toEqual({ learnSoon: true });
    expect(creationPlacementPayload({ pileId: 'book' }, true)).toEqual({
      bookSource: { pileId: 'book' },
      learnSoon: true,
    });
  });
});
