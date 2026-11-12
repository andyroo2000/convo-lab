import { expect, it, vi } from 'vitest';
import { requestJson } from '../../../lib/apiClient';
import { getJournalAudioState } from '../journalAudio';

vi.mock('../../../lib/apiClient', () => ({ requestJson: vi.fn() }));

it('reads saved audio preferences for the exact corrected revision with cancellation', async () => {
  const { signal } = new AbortController();
  const state = { data: { voiceId: 'voice', hasAudio: true } };
  vi.mocked(requestJson).mockResolvedValue(state);
  expect(
    await getJournalAudioState({
      entryId: 'entry/a',
      analysisId: 'analysis',
      expectedReplyRevision: 3,
      signal,
    })
  ).toBe(state);
  expect(requestJson).toHaveBeenCalledWith(
    '/api/journal/entries/entry%2Fa/audio?analysisId=analysis&expectedReplyRevision=3',
    { signal }
  );
});
