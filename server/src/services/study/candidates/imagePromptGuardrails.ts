const STUDY_IMAGE_PROMPT_GUARDRAIL =
  'Natural real-world scene only. No text, words, letters, captions, labels, signs, logos, watermarks, UI, flashcard layout, worksheet, poster, or title.';

export function applyStudyImagePromptGuardrails(imagePrompt: string): string {
  const trimmed = imagePrompt.trim();
  if (!trimmed) return STUDY_IMAGE_PROMPT_GUARDRAIL;

  if (trimmed.includes(STUDY_IMAGE_PROMPT_GUARDRAIL)) {
    return trimmed;
  }

  return `${trimmed}\n\n${STUDY_IMAGE_PROMPT_GUARDRAIL}`;
}

export { STUDY_IMAGE_PROMPT_GUARDRAIL };
