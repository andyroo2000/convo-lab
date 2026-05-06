import { describe, expect, it } from 'vitest';

import { IMAGE_PROMPT_STYLE } from '../../../services/imagePromptGuidance.js';
import {
  applyStudyImagePromptGuardrails,
  STUDY_IMAGE_PROMPT_GUARDRAIL,
} from '../../../services/study/candidates/imagePromptGuardrails.js';
import { buildCandidateSystemInstruction } from '../../../services/study/candidates/promptBuilder.js';

describe('study candidate prompt builder', () => {
  it('adds image and example-sentence guardrails to generated candidates', () => {
    const instruction = buildCandidateSystemInstruction();

    expect(instruction).toContain('No text');
    expect(instruction).toContain('flashcard');
    expect(instruction).toContain('Avoid generic dictionary-style examples');
    expect(instruction).toContain('今日は曇りです。');
    expect(instruction).toContain('concrete situation, time, place, or speaker intention');
    expect(instruction).toContain(IMAGE_PROMPT_STYLE);
    expect(instruction).toContain('they should be Japanese');
    expect(instruction).toContain('set it in Japan');
    expect(instruction).toContain('prompt.clozeHint is required');
    expect(instruction).toContain('English only');
    expect(instruction).toContain('full English sentence translation');
  });

  it('applies style and Japan-immersion guardrails exactly once', () => {
    expect(applyStudyImagePromptGuardrails('A weather flashcard. No text.')).toContain(
      STUDY_IMAGE_PROMPT_GUARDRAIL
    );
    expect(applyStudyImagePromptGuardrails('A weather flashcard. No text.')).toContain(
      IMAGE_PROMPT_STYLE
    );
    expect(applyStudyImagePromptGuardrails('A weather flashcard. No text.')).toContain(
      'If people are shown, they should be Japanese'
    );
    expect(applyStudyImagePromptGuardrails('A weather flashcard. No text.')).toContain(
      'If a place is shown, set it in Japan'
    );

    const guardedPrompt = `A cloudy train platform.\n\n${STUDY_IMAGE_PROMPT_GUARDRAIL}`;
    expect(applyStudyImagePromptGuardrails(guardedPrompt)).toBe(guardedPrompt);
  });
});
