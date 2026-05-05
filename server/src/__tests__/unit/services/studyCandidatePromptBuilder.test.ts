import { describe, expect, it } from 'vitest';

import {
  applyStudyImagePromptGuardrails,
  STUDY_IMAGE_PROMPT_GUARDRAIL,
  STUDY_IMAGE_PROMPT_STYLE,
} from '../../../services/study/candidates/imagePromptGuardrails.js';
import { buildCandidateSystemInstruction } from '../../../services/study/candidates/promptBuilder.js';

describe('study candidate prompt builder', () => {
  it('adds image and example-sentence guardrails to generated candidates', () => {
    const instruction = buildCandidateSystemInstruction();

    expect(instruction).toContain('No text');
    expect(instruction).toContain('flashcard');
    expect(instruction).toContain(STUDY_IMAGE_PROMPT_STYLE);
    expect(instruction).toContain('Avoid generic dictionary-style examples');
    expect(instruction).toContain('今日は曇りです。');
    expect(instruction).toContain('concrete situation, time, place, or speaker intention');
  });

  it('adds the construction-paper style and only treats the exact guardrail as already applied', () => {
    const guarded = applyStudyImagePromptGuardrails('A weather flashcard. No text.');
    expect(guarded).toContain(STUDY_IMAGE_PROMPT_GUARDRAIL);
    expect(guarded).toContain(STUDY_IMAGE_PROMPT_STYLE);

    const guardedPrompt = `A cloudy train platform.\n\n${STUDY_IMAGE_PROMPT_GUARDRAIL}`;
    expect(applyStudyImagePromptGuardrails(guardedPrompt)).toBe(guardedPrompt);
  });
});
