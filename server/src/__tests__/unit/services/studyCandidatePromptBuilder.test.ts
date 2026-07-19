import { describe, expect, it } from 'vitest';

import { IMAGE_PROMPT_STYLE } from '../../../services/imagePromptGuidance.js';
import {
  applyStudyImagePromptGuardrails,
  STUDY_IMAGE_PROMPT_GUARDRAIL,
} from '../../../services/study/candidates/imagePromptGuardrails.js';

describe('study image prompt guardrails', () => {
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
