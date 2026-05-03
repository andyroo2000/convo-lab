const STUDY_IMAGE_PROMPT_GUARDRAIL =
  'Natural real-world scene only. No text, words, letters, captions, labels, signs, logos, watermarks, UI, flashcard layout, worksheet, poster, or title.';

export function applyStudyImagePromptGuardrails(imagePrompt: string): string {
  const trimmed = imagePrompt.trim();
  if (!trimmed) return STUDY_IMAGE_PROMPT_GUARDRAIL;

  const lower = trimmed.toLowerCase();
  if (lower.includes('no text') && lower.includes('flashcard')) {
    return trimmed;
  }

  return `${trimmed}\n\n${STUDY_IMAGE_PROMPT_GUARDRAIL}`;
}

export { STUDY_IMAGE_PROMPT_GUARDRAIL };
