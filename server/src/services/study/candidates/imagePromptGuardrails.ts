import { IMAGE_PROMPT_IMMERSION_GUIDANCE, IMAGE_PROMPT_STYLE } from '../../imagePromptGuidance.js';

export const STUDY_IMAGE_PROMPT_GUARDRAIL = `Use a ${IMAGE_PROMPT_STYLE} style. ${IMAGE_PROMPT_IMMERSION_GUIDANCE} Scene only. No text, words, letters, captions, labels, signs, logos, watermarks, UI, flashcard layout, worksheet, poster, or title.`;

export function applyStudyImagePromptGuardrails(imagePrompt: string): string {
  const trimmed = imagePrompt.trim();
  if (!trimmed) return STUDY_IMAGE_PROMPT_GUARDRAIL;

  if (trimmed.includes(STUDY_IMAGE_PROMPT_GUARDRAIL)) {
    return trimmed;
  }

  return `${trimmed}\n\n${STUDY_IMAGE_PROMPT_GUARDRAIL}`;
}
