import {
  DEFAULT_NARRATOR_VOICES,
  MANUAL_STUDY_CARD_DEFAULT_VOICE_IDS,
} from '@languageflow/shared/src/constants-new.js';
import { STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH } from '@languageflow/shared/src/studyConstants.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildClozeImagePrompt,
  parseVocabBundleResponse,
  truncateAtWordBoundary,
} from '../../../services/study/candidates/vocab/parser.js';

describe('study vocab bundle parser', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses random manual Fish Audio voices instead of the legacy Shohei narrator', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const bundle = await parseVocabBundleResponse({
      response: JSON.stringify({
        targetWord: '営業する',
        targetReading: '営業[えいぎょう]する',
        targetMeaning: 'to do sales',
        sentences: [0, 1, 2].map((ordinal) => ({
          sentenceJp: `営業の例文${String(ordinal + 1)}です。`,
          sentenceReading: `営業[えいぎょう]の例文[れいぶん]${String(ordinal + 1)}です。`,
          sentenceEn: `Sales example ${String(ordinal + 1)}.`,
          clozeText: `{{c1::営業}}の例文${String(ordinal + 1)}です。`,
          clozeHint: 'sales',
        })),
      }),
      targetWord: '営業する',
      sourceSentence: null,
      context: '',
    });

    const voiceIds = bundle.variants.map((variant) =>
      String(variant.candidate.answer.answerAudioVoiceId)
    );
    expect(voiceIds).toHaveLength(11);
    expect(
      voiceIds.every((voiceId) =>
        MANUAL_STUDY_CARD_DEFAULT_VOICE_IDS.some((manualVoiceId) => manualVoiceId === voiceId)
      )
    ).toBe(true);
    expect(voiceIds).not.toContain(DEFAULT_NARRATOR_VOICES.ja);
  });

  it('builds cloze image prompts with safe punctuation and an empty-meaning fallback', () => {
    expect(
      buildClozeImagePrompt({
        meaning: 'Sales work is fun!',
        notes: 'Office scene?',
      })
    ).toBe(
      'A natural immersive scene representing this sentence meaning: Sales work is fun. Context: Office scene. No text.'
    );

    expect(
      buildClozeImagePrompt({
        meaning: '   ',
        notes: null,
      })
    ).toBe(
      'A natural immersive scene representing this sentence meaning: the Japanese sentence. No text.'
    );
  });

  it('truncates long cloze image prompts within the image prompt budget', () => {
    const prompt = buildClozeImagePrompt({
      meaning: 'A learner notices the target word in a busy restaurant.',
      notes: Array.from({ length: 80 }, () => 'context').join(' '),
    });

    expect(prompt.length).toBeLessThanOrEqual(STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH);
    expect(prompt.endsWith(' No text.')).toBe(true);
    expect(prompt).not.toMatch(/\s\s/u);
  });

  it('keeps no-space truncation deterministic', () => {
    expect(truncateAtWordBoundary('あ'.repeat(20), 12)).toBe('あ'.repeat(12));
  });
});
