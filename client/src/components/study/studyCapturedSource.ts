import type { StudyCardSummary } from '@languageflow/shared/src/types';

import { isAudioLedPromptCard } from './studyCardUtils';
import { toNotesList } from './studyTextUtils';

export interface StudyNote {
  text: string;
}

function isTitleOnlyCapture(note: string): boolean {
  return note.startsWith('Captured from ') && !/(?:https?:\/\/|javascript:|data:)/i.test(note);
}

export function getCapturedSource(notes?: string | null): StudyNote | null {
  const lines = toNotesList(notes);
  if (lines.length !== 1) return null;
  if (isTitleOnlyCapture(lines[0])) return { text: lines[0] };
  const match = /^(Captured from(?: .*? —)?) (https:\/\/\S+)$/.exec(lines[0]);
  if (!match) return null;
  try {
    const url = new URL(match[2]);
    if (!['www.netflix.com', 'www.youtube.com', 'youtube.com'].includes(url.hostname)) return null;
    if (url.username || url.password) return null;
    return { text: match[1].replace(/ —$/, '') };
  } catch {
    return null;
  }
}

export function isCapturedDialogueCard(card: StudyCardSummary): boolean {
  return isAudioLedPromptCard(card) && getCapturedSource(card.answer.notes) !== null;
}
