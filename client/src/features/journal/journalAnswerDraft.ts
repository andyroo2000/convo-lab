import { z } from 'zod';
import type { JournalAnswerRequest } from './journalReplies';

export interface AnswerDraft {
  answer: string;
  replace: boolean;
  request?: JournalAnswerRequest;
}
const requestSchema = z.object({
  id: z.string().regex(/^[0-7][0-9a-hjkmnp-tv-z]{25}$/),
  analysisId: z.string(),
  answer: z.string().max(5000),
  expectedRevision: z.number().int().nonnegative(),
  replace: z.boolean(),
});
export function readAnswerDraft(key: string): AnswerDraft {
  const value = JSON.parse(localStorage.getItem(key) ?? 'null') as AnswerDraft | null;
  if (!value || typeof value.answer !== 'string') return { answer: '', replace: false };
  const parsed = requestSchema.safeParse(value.request);
  return {
    answer: value.answer,
    replace: value.replace === true,
    request: parsed.success ? parsed.data : undefined,
  };
}
