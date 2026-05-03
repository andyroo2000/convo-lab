import { describe, expect, it, vi } from 'vitest';

import { resolvePitchAccent } from '../../../../services/pitchAccent/pitchAccentResolver.js';

const entries = [
  { surface: '会社', reading: 'かいしゃ', pitchNum: 0 },
  { surface: '上手', reading: 'じょうず', pitchNum: 3 },
  { surface: '上手', reading: 'うわて', pitchNum: 0 },
  { surface: '日本', reading: 'にほん', pitchNum: 2 },
  { surface: '日本', reading: 'にっぽん', pitchNum: 3 },
  { surface: '橋', reading: 'はし', pitchNum: 2 },
  { surface: '橋', reading: 'はし', pitchNum: 1 },
];

describe('pitchAccentResolver', () => {
  it('resolves directly when a candidate matches a known reading', async () => {
    const selectReading = vi.fn();

    await expect(
      resolvePitchAccent({
        expression: '上手',
        expressionReading: '上手[じょうず]',
        entries,
        selectReading,
      })
    ).resolves.toMatchObject({
      status: 'resolved',
      reading: 'じょうず',
      pitchNum: 3,
      resolvedBy: 'local-reading',
    });
    expect(selectReading).not.toHaveBeenCalled();
  });

  it('preserves alternatives for the same reading with multiple pitch numbers', async () => {
    await expect(
      resolvePitchAccent({ expression: '橋', expressionReading: 'はし', entries })
    ).resolves.toMatchObject({
      status: 'resolved',
      reading: 'はし',
      alternatives: [expect.objectContaining({ pitchNum: 1 })],
    });
  });

  it('uses the LLM only for unresolved homograph readings', async () => {
    const selectReading = vi.fn().mockResolvedValue('にっぽん');

    await expect(
      resolvePitchAccent({
        expression: '日本',
        sentenceJp: '日本代表を応援します。',
        entries,
        selectReading,
      })
    ).resolves.toMatchObject({
      status: 'resolved',
      reading: 'にっぽん',
      resolvedBy: 'llm',
    });
  });

  it('caches unresolved results when the LLM is not confident', async () => {
    const selectReading = vi.fn().mockResolvedValue('');

    await expect(
      resolvePitchAccent({
        expression: '日本',
        sentenceJp: '日本語を勉強します。',
        entries,
        selectReading,
      })
    ).resolves.toMatchObject({
      status: 'unresolved',
      reason: 'ambiguous-reading',
    });
  });

  it('returns unresolved instead of throwing when LLM disambiguation fails', async () => {
    const selectReading = vi.fn().mockRejectedValue(new Error('provider unavailable'));

    await expect(
      resolvePitchAccent({
        expression: '日本',
        sentenceJp: '日本語を勉強します。',
        entries,
        selectReading,
      })
    ).resolves.toMatchObject({
      status: 'unresolved',
      reason: 'ambiguous-reading',
    });
  });
});
