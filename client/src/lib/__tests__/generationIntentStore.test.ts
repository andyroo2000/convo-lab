import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acknowledgeGenerationIntent,
  GenerationIntentStorageError,
  readGenerationIntent,
  writeGenerationIntent,
} from '../generationIntentStore';

const FIRST_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_ID = '22222222-2222-4222-8222-222222222222';

describe('generationIntentStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValue(FIRST_ID) });
  });

  it('persists one owner-scoped UUID with the complete normalized submission', () => {
    const intent = writeGenerationIntent('owner-a', 'dialogue', {
      episode: { sourceText: 'A train ride' },
      dialogue: { dialogueLength: 8 },
    });

    expect(intent).toMatchObject({
      version: 1,
      intentId: FIRST_ID,
      ownerId: 'owner-a',
      kind: 'dialogue',
      payload: {
        episode: { sourceText: 'A train ride' },
        dialogue: { dialogueLength: 8 },
      },
    });
    expect(readGenerationIntent('owner-a', 'dialogue')).toEqual(intent);
    expect(readGenerationIntent('owner-b', 'dialogue')).toBeNull();
    expect(readGenerationIntent('owner-a', 'course')).toBeNull();
    expect(readGenerationIntent('owner-a', 'dialogue-course')).toBeNull();
  });

  it('only removes the exact intent that was acknowledged', () => {
    const first = writeGenerationIntent('owner-a', 'course', { title: 'First' });
    vi.mocked(globalThis.crypto.randomUUID).mockReturnValue(SECOND_ID);
    const second = writeGenerationIntent('owner-a', 'course', { title: 'Second' });

    acknowledgeGenerationIntent(first);
    expect(readGenerationIntent('owner-a', 'course')).toEqual(second);

    acknowledgeGenerationIntent(second);
    expect(readGenerationIntent('owner-a', 'course')).toBeNull();
  });

  it('fails closed when durable storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    expect(() => writeGenerationIntent('owner-a', 'dialogue', { sourceText: 'Story' })).toThrow(
      GenerationIntentStorageError
    );
    expect(window.localStorage.length).toBe(0);
  });

  it('quarantines corrupt saved intents instead of retrying them forever', () => {
    window.localStorage.setItem('convolab.generationIntent.v1.owner-a.dialogue', '{not-valid-json');

    expect(() => readGenerationIntent('owner-a', 'dialogue')).toThrow(GenerationIntentStorageError);
    expect(window.localStorage.length).toBe(0);
  });
});
