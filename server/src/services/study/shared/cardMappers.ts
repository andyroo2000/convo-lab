import type {
  StudyAnswerPayload,
  StudyBrowserField,
  StudyCardSummary,
  StudyMediaRef,
  StudyPromptPayload,
} from '@languageflow/shared/src/types.js';

import { AppError } from '../../../middleware/errorHandler.js';

import { isAudioRecognitionPrompt } from './audioRecognitionUtils.js';
import { ANKI_DECK_NAME } from './constants.js';
import {
  isRecord,
  parseStudyAudioSource,
  parseStudyCardType,
  parseStudyMediaKind,
  parseStudyQueueState,
} from './guards.js';
import { normalizeClozePayload } from './importHelpers.js';
import { getStudyMediaApiPath } from './paths.js';
import { noteFieldValueToString, stripHtml } from './text.js';
import { getRequiredSchedulerState } from './time.js';
import type {
  PersistedStudyMediaRecord,
  StudyBrowserListCardRecord,
  StudyBrowserListNoteRecord,
  StudyCardWithRelations,
  StudyMediaRecord,
} from './types.js';

function hydrateMediaRef(
  mediaRef: StudyMediaRef | null | undefined,
  media: unknown
): StudyMediaRef | null | undefined {
  if (!mediaRef && !media) return mediaRef;

  const mediaRecord = isRecord(media) ? media : null;
  const mediaId =
    typeof mediaRecord?.id === 'string'
      ? mediaRecord.id
      : typeof mediaRef?.id === 'string'
        ? mediaRef.id
        : null;
  const resolvedUrl = mediaId ? getStudyMediaApiPath(mediaId) : (mediaRef?.url ?? null);
  if (!resolvedUrl) return mediaRef;

  return {
    ...(mediaRef ?? {
      filename:
        typeof mediaRecord?.sourceFilename === 'string'
          ? mediaRecord.sourceFilename
          : typeof mediaRecord?.normalizedFilename === 'string'
            ? mediaRecord.normalizedFilename
            : 'media',
      mediaKind: parseStudyMediaKind(mediaRecord?.mediaKind),
      source:
        typeof mediaRecord?.sourceKind === 'string' && mediaRecord.sourceKind === 'generated'
          ? 'generated'
          : typeof mediaRecord?.mediaKind === 'string' && mediaRecord.mediaKind === 'image'
            ? 'imported_image'
            : 'imported',
    }),
    url: resolvedUrl,
  };
}

export async function normalizeStudyCardPayload(record: StudyCardWithRelations): Promise<{
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
}> {
  let prompt: StudyPromptPayload = isRecord(record.promptJson) ? { ...record.promptJson } : {};
  let answer: StudyAnswerPayload = isRecord(record.answerJson) ? { ...record.answerJson } : {};

  const safePrompt: StudyPromptPayload = {
    cueText: typeof prompt.cueText === 'string' ? prompt.cueText : null,
    cueReading: typeof prompt.cueReading === 'string' ? prompt.cueReading : null,
    cueMeaning: typeof prompt.cueMeaning === 'string' ? prompt.cueMeaning : null,
    cueAudio: prompt.cueAudio ?? null,
    cueImage: prompt.cueImage ?? null,
    clozeText: typeof prompt.clozeText === 'string' ? prompt.clozeText : null,
    clozeDisplayText: typeof prompt.clozeDisplayText === 'string' ? prompt.clozeDisplayText : null,
    clozeAnswerText: typeof prompt.clozeAnswerText === 'string' ? prompt.clozeAnswerText : null,
    clozeHint: typeof prompt.clozeHint === 'string' ? prompt.clozeHint : null,
    clozeResolvedHint:
      typeof prompt.clozeResolvedHint === 'string' ? prompt.clozeResolvedHint : null,
  };
  prompt = safePrompt;

  prompt = {
    ...prompt,
    cueAudio: hydrateMediaRef(prompt.cueAudio, record.promptAudioMedia) ?? prompt.cueAudio,
    cueImage: prompt.cueImage
      ? (hydrateMediaRef(prompt.cueImage, record.imageMedia) ?? prompt.cueImage)
      : prompt.cueImage,
  };
  answer = {
    ...answer,
    answerAudioVoiceId:
      typeof answer.answerAudioVoiceId === 'string' ? answer.answerAudioVoiceId : null,
    answerAudioTextOverride:
      typeof answer.answerAudioTextOverride === 'string' ? answer.answerAudioTextOverride : null,
    answerAudio: hydrateMediaRef(answer.answerAudio, record.answerAudioMedia) ?? answer.answerAudio,
    answerImage: answer.answerImage
      ? (hydrateMediaRef(answer.answerImage, record.imageMedia) ?? answer.answerImage)
      : answer.answerImage,
  };

  if (record.cardType === 'recognition' && isAudioRecognitionPrompt(prompt) && answer.answerAudio) {
    prompt = {
      ...prompt,
      cueAudio: answer.answerAudio,
    };
  }

  if (record.cardType !== 'cloze') {
    return { prompt, answer };
  }

  const rawFields = isRecord(record.note.rawFieldsJson) ? record.note.rawFieldsJson : {};
  const activeOrdinal = typeof record.sourceTemplateOrd === 'number' ? record.sourceTemplateOrd : 0;
  const rawClozeText =
    typeof rawFields.Text === 'string' && rawFields.Text.length > 0
      ? String(rawFields.Text)
      : (prompt.clozeText ?? '');
  const fallbackHint =
    stripHtml(
      typeof rawFields.ClozeHint === 'string' && rawFields.ClozeHint.length > 0
        ? rawFields.ClozeHint
        : (prompt.clozeHint ?? prompt.clozeResolvedHint ?? '')
    ) ?? null;
  const restoredText =
    answer.restoredText ??
    stripHtml(typeof rawFields.AnswerExpression === 'string' ? rawFields.AnswerExpression : '') ??
    null;
  const needsNormalization =
    /\{\{c\d+::/.test(prompt.clozeDisplayText ?? '') ||
    prompt.clozeDisplayText == null ||
    prompt.clozeAnswerText == null ||
    prompt.clozeResolvedHint == null ||
    answer.restoredTextReading == null;

  if (!needsNormalization) {
    return { prompt, answer };
  }

  return normalizeClozePayload({
    activeOrdinal,
    prompt: {
      ...prompt,
      clozeText: rawClozeText,
      clozeHint: prompt.clozeHint ?? fallbackHint,
    },
    answer: {
      ...answer,
      restoredText,
    },
  });
}

export async function toStudyCardSummary(
  record: StudyCardWithRelations
): Promise<StudyCardSummary> {
  const noteRecord = record.note;
  const normalized = await normalizeStudyCardPayload(record);

  return {
    id: record.id,
    noteId: record.noteId,
    cardType: parseStudyCardType(record.cardType),
    prompt: normalized.prompt,
    answer: normalized.answer,
    state: {
      dueAt: record.dueAt instanceof Date ? record.dueAt.toISOString() : null,
      introducedAt: record.introducedAt instanceof Date ? record.introducedAt.toISOString() : null,
      queueState: parseStudyQueueState(record.queueState),
      scheduler: getRequiredSchedulerState(record),
      source: {
        noteId:
          typeof noteRecord.sourceNoteId === 'bigint' ? String(noteRecord.sourceNoteId) : null,
        noteGuid: typeof noteRecord.sourceGuid === 'string' ? String(noteRecord.sourceGuid) : null,
        cardId: typeof record.sourceCardId === 'bigint' ? String(record.sourceCardId) : null,
        deckId: typeof record.sourceDeckId === 'bigint' ? String(record.sourceDeckId) : null,
        deckName:
          typeof record.sourceDeckName === 'string' ? record.sourceDeckName : ANKI_DECK_NAME,
        notetypeId:
          typeof noteRecord.sourceNotetypeId === 'bigint'
            ? String(noteRecord.sourceNotetypeId)
            : null,
        notetypeName:
          typeof noteRecord.sourceNotetypeName === 'string'
            ? String(noteRecord.sourceNotetypeName)
            : null,
        templateOrd: typeof record.sourceTemplateOrd === 'number' ? record.sourceTemplateOrd : null,
        templateName:
          typeof record.sourceTemplateName === 'string' ? record.sourceTemplateName : null,
        queue: typeof record.sourceQueue === 'number' ? record.sourceQueue : null,
        type: typeof record.sourceCardType === 'number' ? record.sourceCardType : null,
        due: typeof record.sourceDue === 'number' ? record.sourceDue : null,
        ivl: typeof record.sourceInterval === 'number' ? record.sourceInterval : null,
        factor: typeof record.sourceFactor === 'number' ? record.sourceFactor : null,
        reps: typeof record.sourceReps === 'number' ? record.sourceReps : null,
        lapses: typeof record.sourceLapses === 'number' ? record.sourceLapses : null,
        left: typeof record.sourceLeft === 'number' ? record.sourceLeft : null,
        odue: typeof record.sourceOriginalDue === 'number' ? record.sourceOriginalDue : null,
        odid:
          typeof record.sourceOriginalDeckId === 'bigint'
            ? String(record.sourceOriginalDeckId)
            : null,
      },
      rawFsrs: isRecord(record.sourceFsrsJson) ? record.sourceFsrsJson : null,
    },
    answerAudioSource: parseStudyAudioSource(record.answerAudioSource),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function getNoteDisplayText(
  note: Pick<StudyBrowserListNoteRecord, 'id' | 'rawFieldsJson'>,
  cards: Array<Pick<StudyBrowserListCardRecord, 'promptJson' | 'answerJson'>>
): string {
  const rawFields = isRecord(note.rawFieldsJson) ? note.rawFieldsJson : {};
  const candidates = [
    noteFieldValueToString(rawFields.Expression),
    noteFieldValueToString(rawFields.Text),
    noteFieldValueToString(rawFields.AnswerExpression),
  ];

  for (const candidate of candidates) {
    const stripped = stripHtml(candidate) ?? candidate;
    if (stripped) return stripped;
  }

  for (const card of cards) {
    const prompt = isRecord(card.promptJson) ? card.promptJson : {};
    const answer = isRecord(card.answerJson) ? card.answerJson : {};
    const next =
      noteFieldValueToString(prompt.cueText) ??
      noteFieldValueToString(prompt.clozeDisplayText) ??
      noteFieldValueToString(answer.expression) ??
      noteFieldValueToString(answer.restoredText);
    if (next) return stripHtml(next) ?? next;
  }

  return typeof note.id === 'string' ? note.id : 'Untitled note';
}

export function buildMediaLookup(cards: StudyCardSummary[]): Map<string, StudyMediaRef> {
  const media = new Map<string, StudyMediaRef>();

  for (const card of cards) {
    const refs = [
      card.prompt.cueAudio,
      card.prompt.cueImage,
      card.answer.answerAudio,
      card.answer.answerImage,
    ];

    for (const ref of refs) {
      if (ref?.filename && !media.has(ref.filename)) {
        media.set(ref.filename, ref);
      }
    }
  }

  return media;
}

export function toStudyBrowserField(
  name: string,
  value: unknown,
  mediaLookup: Map<string, StudyMediaRef>
): StudyBrowserField {
  const stringValue = noteFieldValueToString(value);
  const audio = stringValue
    ? (stringValue
        .match(/\[sound:([^\]]+)\]/g)
        ?.map((match) => match.slice(7, -1))
        .map((filename) => mediaLookup.get(filename))
        .find((entry): entry is StudyMediaRef => Boolean(entry)) ?? null)
    : null;
  const image = stringValue
    ? (Array.from(stringValue.matchAll(/<img[^>]+src=["']([^"']+)["']/gi), (match) => match[1])
        .map((filename) => mediaLookup.get(filename))
        .find((entry): entry is StudyMediaRef => Boolean(entry)) ?? null)
    : null;

  return {
    name,
    value: stringValue,
    textValue: stringValue ? (stripHtml(stringValue) ?? stringValue) : null,
    audio,
    image,
  };
}

export function mergeStudyMediaRecord(
  current: StudyMediaRecord | null,
  updated: PersistedStudyMediaRecord
): StudyMediaRecord {
  if (!current) {
    throw new AppError('Study media relation is missing.', 500);
  }

  return {
    ...current,
    ...updated,
    sourceKind: updated.sourceKind ?? current.sourceKind,
    sourceFilename: updated.sourceFilename ?? current.sourceFilename,
    normalizedFilename: updated.normalizedFilename ?? current.normalizedFilename,
    mediaKind: updated.mediaKind ?? current.mediaKind,
    storagePath: updated.storagePath ?? current.storagePath,
    publicUrl: updated.publicUrl ?? current.publicUrl,
    contentType: current.contentType,
    sourceMediaKey: current.sourceMediaKey,
    createdAt: current.createdAt,
    updatedAt: current.updatedAt,
  };
}
