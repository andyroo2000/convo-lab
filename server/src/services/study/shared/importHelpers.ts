import { normalizeLooseClozeText } from '@languageflow/shared/src/studyCloze.js';
import type { StudyAnswerPayload, StudyPromptPayload } from '@languageflow/shared/src/types.js';

import { generateJapaneseReading } from '../../japaneseReadingGenerator.js';

import { stripHtml, toSearchText } from './text.js';
import type { JsonRecord } from './types.js';

interface ParsedClozeToken {
  clozeIndex: number;
  content: string;
  hint: string | null;
}

function parseClozeToken(rawToken: string): ParsedClozeToken | null {
  if (!rawToken.startsWith('{{c') || !rawToken.endsWith('}}')) {
    return null;
  }

  let cursor = 3;
  let rawIndex = '';
  while (cursor < rawToken.length && /\d/.test(rawToken[cursor] ?? '')) {
    rawIndex += rawToken[cursor];
    cursor += 1;
  }

  if (!rawIndex || rawToken.slice(cursor, cursor + 2) !== '::') {
    return null;
  }
  cursor += 2;

  const body = rawToken.slice(cursor, -2);
  const separatorIndex = body.indexOf('::');
  if (separatorIndex === -1) {
    return {
      clozeIndex: Number.parseInt(rawIndex, 10),
      content: body,
      hint: null,
    };
  }

  return {
    clozeIndex: Number.parseInt(rawIndex, 10),
    content: body.slice(0, separatorIndex),
    hint: body.slice(separatorIndex + 2),
  };
}

function parseAnkiClozeText(rawText: string, activeOrdinal: number, fallbackHint: string | null) {
  const activeClozeIndex = activeOrdinal + 1;
  let activeAnswerText: string | null = null;
  let inlineHint: string | null = null;
  let hadMalformedMarkup = false;
  const restoredParts: string[] = [];
  const displayParts: string[] = [];
  const source = rawText.replaceAll('\0', '');
  let cursor = 0;

  while (cursor < source.length) {
    const tokenStart = source.indexOf('{{c', cursor);
    if (tokenStart === -1) {
      const trailing = source.slice(cursor);
      restoredParts.push(trailing);
      displayParts.push(trailing);
      break;
    }

    const leading = source.slice(cursor, tokenStart);
    restoredParts.push(leading);
    displayParts.push(leading);

    const tokenEnd = source.indexOf('}}', tokenStart);
    if (tokenEnd === -1) {
      const trailing = source.slice(tokenStart);
      restoredParts.push(trailing);
      displayParts.push(trailing);
      hadMalformedMarkup = true;
      break;
    }

    const rawToken = source.slice(tokenStart, tokenEnd + 2);
    const token = parseClozeToken(rawToken);
    if (!token) {
      restoredParts.push(rawToken);
      displayParts.push(rawToken);
      hadMalformedMarkup = true;
      cursor = tokenEnd + 2;
      continue;
    }

    restoredParts.push(token.content);
    if (token.clozeIndex === activeClozeIndex) {
      activeAnswerText = stripHtml(token.content) ?? token.content;
      inlineHint = stripHtml(token.hint) ?? null;
      displayParts.push('[...]');
    } else {
      displayParts.push(token.content);
    }

    cursor = tokenEnd + 2;
  }

  return {
    displayText: stripHtml(displayParts.join('')) ?? null,
    answerText: activeAnswerText,
    restoredText: stripHtml(restoredParts.join('')) ?? null,
    resolvedHint: inlineHint ?? fallbackHint,
    hadMalformedMarkup,
  };
}

function getProvidedRestoredTextReading(answer: StudyAnswerPayload): string | null {
  const reading = answer.restoredTextReading;
  return typeof reading === 'string' && reading.trim().length > 0 ? reading : null;
}

async function resolveRestoredTextReading(
  answer: StudyAnswerPayload,
  restoredText: string | null
): Promise<string | null> {
  return (
    getProvidedRestoredTextReading(answer) ??
    (restoredText ? await generateJapaneseReading(restoredText) : null)
  );
}

export async function normalizeClozePayload(params: {
  activeOrdinal: number;
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
}) {
  const fallbackHint = stripHtml(params.prompt.clozeHint ?? params.prompt.clozeResolvedHint ?? '');
  const rawClozeText = normalizeLooseClozeText(params.prompt.clozeText) ?? '';
  const hasAnkiClozeMarkup = /\{\{c\d+::/.test(rawClozeText);

  let clozeDisplayText = params.prompt.clozeDisplayText ?? null;
  let clozeAnswerText = params.prompt.clozeAnswerText ?? null;
  let resolvedHint = params.prompt.clozeResolvedHint ?? fallbackHint;
  let restoredText = params.answer.restoredText ?? null;
  let malformedMarkup = false;

  if (hasAnkiClozeMarkup) {
    const parsed = parseAnkiClozeText(rawClozeText, params.activeOrdinal, fallbackHint);
    clozeDisplayText = parsed.displayText;
    clozeAnswerText = parsed.answerText;
    resolvedHint = parsed.resolvedHint;
    restoredText = parsed.restoredText ?? restoredText;
    malformedMarkup = parsed.hadMalformedMarkup;
  } else {
    clozeDisplayText = clozeDisplayText ?? stripHtml(rawClozeText);
    resolvedHint = resolvedHint ?? fallbackHint;
  }

  const restoredTextReading = await resolveRestoredTextReading(params.answer, restoredText);

  return {
    malformedMarkup,
    prompt: {
      ...params.prompt,
      clozeText: rawClozeText || null,
      clozeDisplayText,
      clozeAnswerText,
      clozeResolvedHint: resolvedHint,
      clozeHint: params.prompt.clozeHint ?? fallbackHint,
    },
    answer: {
      ...params.answer,
      restoredText,
      restoredTextReading,
    },
  };
}

export function buildStudyNoteSearchText(note: {
  rawFields: JsonRecord;
  canonical: JsonRecord;
}): string {
  return toSearchText(note.rawFields, note.canonical);
}

export function buildStudyCardSearchText(card: {
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
}): string {
  return toSearchText(card.prompt, card.answer);
}
