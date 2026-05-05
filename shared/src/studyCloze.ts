import type { StudyAnswerPayload, StudyPromptPayload } from './types.js';

const CLOZE_MARKUP_PATTERN = /\{\{c\d+::/;

interface ParsedClozeToken {
  clozeIndex: number;
  content: string;
  hint: string | null;
}

export interface DerivedClozePresentation {
  answerText: string | null;
  displayText: string | null;
  malformedMarkup: boolean;
  normalizedClozeText: string | null;
  resolvedHint: string | null;
  restoredText: string | null;
}

function stripHtmlToNull(value: string | null | undefined): string | null {
  if (!value) return null;

  let stripped = '';
  let insideTag = false;
  for (const character of value) {
    if (character === '<') {
      insideTag = true;
      continue;
    }
    if (character === '>' && insideTag) {
      insideTag = false;
      continue;
    }
    if (!insideTag) {
      stripped += character;
    }
  }

  stripped = stripped.trim();
  return stripped ? stripped : null;
}

export function normalizeLooseClozeText(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  if (CLOZE_MARKUP_PATTERN.test(text)) return text;

  let normalized = '';
  let hiddenText: string | null = null;

  for (const character of text) {
    if (hiddenText !== null) {
      if (character === ']') {
        normalized += hiddenText.length > 0 ? `{{c1::${hiddenText}}}` : '[]';
        hiddenText = null;
      } else {
        hiddenText += character;
      }
      continue;
    }

    if (character === '[') {
      hiddenText = '';
    } else {
      normalized += character;
    }
  }

  if (hiddenText !== null) {
    normalized += `[${hiddenText}`;
  }

  return normalized;
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

export function deriveClozePresentation(
  rawText: string | null | undefined,
  activeOrdinal = 0,
  fallbackHint: string | null = null
): DerivedClozePresentation {
  const normalizedClozeText = normalizeLooseClozeText(rawText);
  const source = normalizedClozeText?.replace(/\0/g, '') ?? '';
  const activeClozeIndex = activeOrdinal + 1;
  let answerText: string | null = null;
  let inlineHint: string | null = null;
  let malformedMarkup = false;
  const restoredParts: string[] = [];
  const displayParts: string[] = [];
  let cursor = 0;

  if (!CLOZE_MARKUP_PATTERN.test(source)) {
    return {
      answerText: null,
      displayText: stripHtmlToNull(source),
      malformedMarkup: false,
      normalizedClozeText,
      resolvedHint: fallbackHint,
      restoredText: stripHtmlToNull(source),
    };
  }

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
      malformedMarkup = true;
      break;
    }

    const rawToken = source.slice(tokenStart, tokenEnd + 2);
    const token = parseClozeToken(rawToken);
    if (!token) {
      restoredParts.push(rawToken);
      displayParts.push(rawToken);
      malformedMarkup = true;
      cursor = tokenEnd + 2;
      continue;
    }

    restoredParts.push(token.content);
    if (token.clozeIndex === activeClozeIndex) {
      answerText = stripHtmlToNull(token.content) ?? token.content;
      inlineHint = stripHtmlToNull(token.hint);
      displayParts.push('[...]');
    } else {
      displayParts.push(token.content);
    }

    cursor = tokenEnd + 2;
  }

  return {
    answerText,
    displayText: stripHtmlToNull(displayParts.join('')),
    malformedMarkup,
    normalizedClozeText,
    resolvedHint: inlineHint ?? fallbackHint,
    restoredText: stripHtmlToNull(restoredParts.join('')),
  };
}

export function normalizeClozePayloadFields(
  prompt: StudyPromptPayload,
  answer: StudyAnswerPayload,
  activeOrdinal = 0
) {
  const fallbackHint = stripHtmlToNull(prompt.clozeHint ?? prompt.clozeResolvedHint ?? '');
  const derived = deriveClozePresentation(prompt.clozeText, activeOrdinal, fallbackHint);
  const hasClozeMarkup = Boolean(
    derived.normalizedClozeText && CLOZE_MARKUP_PATTERN.test(derived.normalizedClozeText)
  );
  const clozeDisplayText = hasClozeMarkup
    ? derived.displayText
    : (prompt.clozeDisplayText ?? derived.displayText);
  const clozeAnswerText = hasClozeMarkup
    ? derived.answerText
    : (prompt.clozeAnswerText ?? derived.answerText);

  return {
    malformedMarkup: derived.malformedMarkup,
    prompt: {
      ...prompt,
      clozeText: derived.normalizedClozeText,
      clozeDisplayText,
      clozeAnswerText,
      clozeResolvedHint: prompt.clozeResolvedHint ?? derived.resolvedHint,
      clozeHint: prompt.clozeHint ?? fallbackHint,
    },
    answer: {
      ...answer,
      restoredText: answer.restoredText ?? derived.restoredText,
    },
  };
}
