import { createHash, randomUUID } from 'crypto';
import { createRequire } from 'module';
import path from 'path';
import * as zlib from 'zlib';

import { serializeStudyFsrsCard as serializeFsrsCard } from '@languageflow/shared/src/studyFsrs.js';
import type {
  StudyAnswerPayload,
  StudyAudioSource,
  StudyCardType,
  StudyFsrsState,
  StudyPromptPayload,
  StudyQueueState,
} from '@languageflow/shared/src/types.js';
import initSqlJs, { type Database, type QueryExecResult } from 'sql.js';
import { State, type Card } from 'ts-fsrs';
import { open as openZipFile, type Entry, type ZipFile } from 'yauzl';

import { AppError } from '../../../middleware/errorHandler.js';
import { addFuriganaBrackets } from '../../furiganaService.js';

import { ANKI_DECK_NAME, FIELD_SEPARATOR } from './constants.js';
import { isRecord, parseJsonRecord, sanitizeText } from './guards.js';
import { persistStudyMediaBuffer } from './mediaHelpers.js';
import {
  isAllowedStudyImportZipEntryName,
  isSafeZipBasename,
  getContentType,
  getMediaKind,
  normalizeZipPath,
} from './paths.js';
import { recordStudyImportWarning, createStudyImportWarningAccumulator } from './payloads.js';
import { stripHtml, toSearchText } from './text.js';
import type {
  JsonRecord,
  LegacyDeckConfig,
  LegacyModelConfig,
  ParsedAnkiMediaRecord,
  ParsedCardRow,
  ParsedImportDataset,
  ParsedReviewLogRow,
  QueryRow,
} from './types.js';

const require = createRequire(import.meta.url);
const sqlJsWasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
const zstdWasm = require('@bokuweb/zstd-wasm') as {
  init: () => Promise<void>;
  decompress: (buffer: Uint8Array, opts?: { defaultHeapSize?: number }) => Uint8Array;
};
let sqlJsPromise: Promise<Awaited<ReturnType<typeof initSqlJs>>> | null = null;
let zstdWasmInitPromise: Promise<void> | null = null;
const zstdDecompressSync = (
  zlib as typeof zlib & {
    zstdDecompressSync?: (buffer: Buffer | Uint8Array) => Buffer | Uint8Array;
  }
).zstdDecompressSync;

function isZstdCompressed(buffer: Buffer | Uint8Array): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x28 &&
    buffer[1] === 0xb5 &&
    buffer[2] === 0x2f &&
    buffer[3] === 0xfd
  );
}

async function initZstdWasm(): Promise<void> {
  if (!zstdWasmInitPromise) {
    zstdWasmInitPromise = zstdWasm.init().catch((error) => {
      zstdWasmInitPromise = null;
      throw error;
    });
  }

  await zstdWasmInitPromise;
}

async function maybeDecompressZstd(
  buffer: Buffer,
  options: {
    context?: string;
    expectedSize?: number | null;
  } = {}
): Promise<Buffer> {
  if (!isZstdCompressed(buffer)) {
    return buffer;
  }

  try {
    if (zstdDecompressSync) {
      return Buffer.from(zstdDecompressSync(buffer));
    }

    await initZstdWasm();
    return Buffer.from(
      zstdWasm.decompress(
        buffer,
        typeof options.expectedSize === 'number' && options.expectedSize >= 0
          ? { defaultHeapSize: options.expectedSize }
          : undefined
      )
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    console.warn(
      `[Study] Failed to decompress zstd-compressed Anki data${
        options.context ? ` (${options.context})` : ''
      }:`,
      error
    );
    throw new AppError('The uploaded zstd-compressed Anki data could not be decompressed.', 400);
  }
}

interface ParsedMediaManifestEntry {
  id: string;
  sha1: Buffer | null;
  size: number | null;
}

interface ParsedMediaManifest {
  mediaByFilename: Map<string, ParsedMediaManifestEntry>;
  unsafeManifestFilenames: Set<string>;
  mediaFilesMayBeZstdCompressed: boolean;
}

interface DecodedMediaEntry {
  name: string;
  legacyZipFilename: number | null;
  sha1: Buffer | null;
  size: number | null;
}

function readProtoVarint(buffer: Buffer, offset: number): { value: number; offset: number } {
  let value = 0;
  let shift = 0;
  let cursor = offset;

  while (cursor < buffer.length) {
    const byte = buffer[cursor] ?? 0;
    value += (byte & 0x7f) * 2 ** shift;
    cursor += 1;

    if ((byte & 0x80) === 0) {
      return { value, offset: cursor };
    }

    shift += 7;
    if (shift > 49) {
      break;
    }
  }

  throw new AppError('The uploaded Anki media manifest could not be parsed.', 400);
}

function skipProtoField(buffer: Buffer, wireType: number, offset: number): number {
  if (wireType === 0) {
    return readProtoVarint(buffer, offset).offset;
  }

  if (wireType === 1) {
    return offset + 8;
  }

  if (wireType === 2) {
    const length = readProtoVarint(buffer, offset);
    return length.offset + length.value;
  }

  if (wireType === 5) {
    return offset + 4;
  }

  throw new AppError('The uploaded Anki media manifest could not be parsed.', 400);
}

function decodeMediaEntry(buffer: Buffer): DecodedMediaEntry {
  let offset = 0;
  let name = '';
  let legacyZipFilename: number | null = null;
  let sha1: Buffer | null = null;
  let size: number | null = null;

  while (offset < buffer.length) {
    const tag = readProtoVarint(buffer, offset);
    offset = tag.offset;
    const fieldNumber = Math.floor(tag.value / 8);
    const wireType = tag.value % 8;

    if (fieldNumber === 1 && wireType === 2) {
      const length = readProtoVarint(buffer, offset);
      offset = length.offset;
      if (offset + length.value > buffer.length) {
        throw new AppError('The uploaded Anki media manifest could not be parsed.', 400);
      }
      name = buffer.subarray(offset, offset + length.value).toString('utf8');
      offset += length.value;
      continue;
    }

    if (fieldNumber === 2 && wireType === 0) {
      const value = readProtoVarint(buffer, offset);
      size = value.value;
      offset = value.offset;
      continue;
    }

    if (fieldNumber === 3 && wireType === 2) {
      const length = readProtoVarint(buffer, offset);
      offset = length.offset;
      if (offset + length.value > buffer.length) {
        throw new AppError('The uploaded Anki media manifest could not be parsed.', 400);
      }
      sha1 = Buffer.from(buffer.subarray(offset, offset + length.value));
      offset += length.value;
      continue;
    }

    if (fieldNumber === 255 && wireType === 0) {
      const value = readProtoVarint(buffer, offset);
      legacyZipFilename = value.value;
      offset = value.offset;
      continue;
    }

    offset = skipProtoField(buffer, wireType, offset);
  }

  return { name, legacyZipFilename, sha1, size };
}

function decodeMediaEntriesManifest(buffer: Buffer): DecodedMediaEntry[] {
  const entries: DecodedMediaEntry[] = [];
  let offset = 0;

  while (offset < buffer.length) {
    const tag = readProtoVarint(buffer, offset);
    offset = tag.offset;
    const fieldNumber = Math.floor(tag.value / 8);
    const wireType = tag.value % 8;

    if (fieldNumber === 1 && wireType === 2) {
      const length = readProtoVarint(buffer, offset);
      offset = length.offset;
      const entryEnd = offset + length.value;
      if (entryEnd > buffer.length) {
        throw new AppError('The uploaded Anki media manifest could not be parsed.', 400);
      }
      entries.push(decodeMediaEntry(buffer.subarray(offset, entryEnd)));
      offset = entryEnd;
      continue;
    }

    offset = skipProtoField(buffer, wireType, offset);
    if (offset > buffer.length) {
      throw new AppError('The uploaded Anki media manifest could not be parsed.', 400);
    }
  }

  return entries;
}

function parseMediaManifest(params: {
  buffer: Buffer;
  importWarnings: ReturnType<typeof createStudyImportWarningAccumulator>;
}): ParsedMediaManifest {
  const { buffer, importWarnings } = params;
  const mediaByFilename = new Map<string, ParsedMediaManifestEntry>();
  const unsafeManifestFilenames = new Set<string>();
  const trimmed = buffer.toString('utf8').trimStart();

  if (trimmed.startsWith('{')) {
    const parsedMediaManifest = JSON.parse(trimmed);
    if (isRecord(parsedMediaManifest)) {
      for (const [rawMediaId, rawMediaFilename] of Object.entries(parsedMediaManifest)) {
        if (typeof rawMediaFilename !== 'string') {
          continue;
        }

        const mediaId = normalizeZipPath(rawMediaId);
        const mediaFilename = normalizeZipPath(rawMediaFilename);
        if (!isSafeZipBasename(mediaId) || !isSafeZipBasename(mediaFilename)) {
          if (mediaFilename) {
            unsafeManifestFilenames.add(mediaFilename);
          }
          recordStudyImportWarning(
            importWarnings,
            mediaFilename || rawMediaFilename || rawMediaId,
            'Skipped unsafe media path.'
          );
          continue;
        }

        mediaByFilename.set(mediaFilename, {
          id: mediaId,
          sha1: null,
          size: null,
        });
      }
    }

    return {
      mediaByFilename,
      unsafeManifestFilenames,
      mediaFilesMayBeZstdCompressed: false,
    };
  }

  if (buffer.length === 0) {
    return {
      mediaByFilename,
      unsafeManifestFilenames,
      mediaFilesMayBeZstdCompressed: false,
    };
  }

  const mediaEntries = decodeMediaEntriesManifest(buffer);
  if (mediaEntries.length === 0) {
    throw new AppError('The uploaded Anki media manifest could not be parsed.', 400);
  }

  mediaEntries.forEach((entry, index) => {
    const mediaFilename = normalizeZipPath(entry.name);
    const mediaId = String(entry.legacyZipFilename ?? index);
    if (!isSafeZipBasename(mediaId) || !isSafeZipBasename(mediaFilename)) {
      if (mediaFilename) {
        unsafeManifestFilenames.add(mediaFilename);
      }
      recordStudyImportWarning(
        importWarnings,
        mediaFilename || entry.name || mediaId,
        'Skipped unsafe media path.'
      );
      return;
    }

    mediaByFilename.set(mediaFilename, {
      id: mediaId,
      sha1: entry.sha1,
      size: entry.size,
    });
  });

  return {
    mediaByFilename,
    unsafeManifestFilenames,
    mediaFilesMayBeZstdCompressed: true,
  };
}

function hasMatchingSha1(buffer: Buffer, expectedSha1: Buffer | null): boolean {
  if (!expectedSha1) {
    return true;
  }

  return createHash('sha1').update(buffer).digest().equals(expectedSha1);
}

function parseAudioFilenames(value: string): string[] {
  return Array.from(value.replaceAll('\0', '').matchAll(/\[sound:([^\]]+)\]/g), (match) => match[1])
    .map((filename) => filename.replaceAll('\0', ''))
    .filter(Boolean);
}

function parseImageFilenames(value: string): string[] {
  return Array.from(
    value.replaceAll('\0', '').matchAll(/<img[^>]+src=["']([^"']+)["']/gi),
    (match) => match[1].replaceAll('\0', '')
  ).filter(Boolean);
}

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

export async function normalizeClozePayload(params: {
  activeOrdinal: number;
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
}) {
  const fallbackHint = stripHtml(params.prompt.clozeHint ?? params.prompt.clozeResolvedHint ?? '');
  const rawClozeText = params.prompt.clozeText ?? '';
  const hasAnkiClozeMarkup = /\{\{c\d+::/.test(rawClozeText);

  let clozeDisplayText = params.prompt.clozeDisplayText ?? null;
  let clozeAnswerText = params.prompt.clozeAnswerText ?? null;
  let resolvedHint = params.prompt.clozeResolvedHint ?? fallbackHint;
  let restoredText = params.answer.restoredText ?? null;

  if (hasAnkiClozeMarkup) {
    const parsed = parseAnkiClozeText(rawClozeText, params.activeOrdinal, fallbackHint);
    clozeDisplayText = parsed.displayText;
    clozeAnswerText = parsed.answerText;
    resolvedHint = parsed.resolvedHint;
    restoredText = parsed.restoredText ?? restoredText;
    return {
      malformedMarkup: parsed.hadMalformedMarkup,
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
        restoredTextReading: restoredText ? await addFuriganaBrackets(restoredText) : null,
      },
    };
  } else {
    clozeDisplayText = clozeDisplayText ?? stripHtml(rawClozeText);
    resolvedHint = resolvedHint ?? fallbackHint;
  }

  const restoredTextReading = restoredText ? await addFuriganaBrackets(restoredText) : null;

  return {
    malformedMarkup: false,
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

function toUnsupportedDeckError(detectedDeckNames: string[]): AppError {
  const visibleDeckNames = detectedDeckNames.slice(0, 5);
  const deckSummary = visibleDeckNames.length
    ? ` Found: ${visibleDeckNames.map((name) => `"${name}"`).join(', ')}${
        detectedDeckNames.length > visibleDeckNames.length ? ', …' : ''
      }.`
    : '';

  return new AppError(
    `Only the "${ANKI_DECK_NAME}" deck is supported in this version.${deckSummary}`,
    400
  );
}

function mapRows(result: QueryExecResult[]): QueryRow[] {
  if (result.length === 0) return [];
  const [{ columns, values }] = result;
  return values.map((valueRow) =>
    Object.fromEntries(columns.map((column, index) => [column, valueRow[index] ?? null]))
  );
}

function hasTable(db: Database, tableName: string): boolean {
  const rows = mapRows(
    db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name = $tableName LIMIT 1", {
      $tableName: tableName,
    })
  );
  return rows.length > 0;
}

function parseLegacyDeckAndModelMetadata(collectionRow: QueryRow) {
  const decksRaw =
    typeof collectionRow.decks === 'string' ? collectionRow.decks.replaceAll('\0', '') : '{}';
  const modelsRaw =
    typeof collectionRow.models === 'string' ? collectionRow.models.replaceAll('\0', '') : '{}';

  const decks = JSON.parse(decksRaw) as Record<string, LegacyDeckConfig>;
  const models = JSON.parse(modelsRaw) as Record<string, LegacyModelConfig>;
  const detectedDeckNames = Object.values(decks)
    .map((deck) => (typeof deck?.name === 'string' ? deck.name : ''))
    .filter((name) => name.length > 0);

  const targetDeck = Object.values(decks).find((deck) => deck?.name === ANKI_DECK_NAME);
  if (!targetDeck || typeof targetDeck.id !== 'number') {
    throw toUnsupportedDeckError(detectedDeckNames);
  }

  const fieldNamesByNoteType = new Map<number, string[]>();
  const noteTypeNameById = new Map<number, string>();
  const templateNameByNoteTypeAndOrd = new Map<string, string>();

  for (const model of Object.values(models)) {
    if (!model || typeof model.id !== 'number') continue;

    noteTypeNameById.set(model.id, sanitizeText(model.name) ?? '');

    const fields = [...(model.flds ?? [])]
      .sort((left, right) => (left.ord ?? 0) - (right.ord ?? 0))
      .map((field) => sanitizeText(field.name) ?? '');
    fieldNamesByNoteType.set(model.id, fields);

    for (const template of model.tmpls ?? []) {
      if (typeof template.ord !== 'number') continue;
      templateNameByNoteTypeAndOrd.set(
        `${model.id}:${template.ord}`,
        sanitizeText(template.name) ?? `ord:${template.ord}`
      );
    }
  }

  return {
    deckId: targetDeck.id,
    fieldNamesByNoteType,
    noteTypeNameById,
    templateNameByNoteTypeAndOrd,
  };
}

function toQueueState(sourceQueue: number, sourceType: number): StudyQueueState {
  if (sourceQueue === -1) {
    return sourceType === 0 ? 'buried' : 'suspended';
  }
  if (sourceType === 0) return 'new';
  if (sourceType === 1) return 'learning';
  if (sourceType === 3) return 'relearning';
  return 'review';
}

function toDueAt(
  collectionCreatedAtSeconds: number,
  sourceQueue: number,
  sourceType: number,
  due: number
): Date | null {
  if (sourceQueue === -1 || sourceType === 0) {
    return null;
  }

  if (sourceType === 2) {
    return new Date((collectionCreatedAtSeconds + due * 86400) * 1000);
  }

  if (due > 1_000_000_000) {
    return new Date(due * 1000);
  }

  return new Date(Date.now() + due * 60_000);
}

function toLastReviewedAt(
  sourceFsrs: JsonRecord | null,
  dueAt: Date | null,
  sourceInterval: number
): Date | null {
  const lastReviewTimestamp = sourceFsrs?.lrt;
  if (typeof lastReviewTimestamp === 'number') {
    return new Date(lastReviewTimestamp * 1000);
  }

  if (!dueAt || sourceInterval <= 0) {
    return null;
  }

  const lastReviewedAt = new Date(dueAt);
  lastReviewedAt.setUTCDate(lastReviewedAt.getUTCDate() - sourceInterval);
  return lastReviewedAt;
}

function toSchedulerState(
  sourceFsrs: JsonRecord | null,
  dueAt: Date | null,
  queueState: StudyQueueState,
  sourceInterval: number,
  sourceReps: number,
  sourceLapses: number,
  lastReviewedAt: Date | null
): StudyFsrsState {
  const state =
    queueState === 'new'
      ? State.New
      : queueState === 'learning'
        ? State.Learning
        : queueState === 'relearning'
          ? State.Relearning
          : State.Review;

  const card: Card = {
    due: dueAt ?? new Date(),
    stability: typeof sourceFsrs?.s === 'number' ? sourceFsrs.s : Math.max(sourceInterval, 0.1),
    difficulty: Math.max(1, Math.min(typeof sourceFsrs?.d === 'number' ? sourceFsrs.d : 5, 10)),
    elapsed_days:
      lastReviewedAt === null
        ? 0
        : Math.max(0, Math.floor((Date.now() - lastReviewedAt.getTime()) / (1000 * 60 * 60 * 24))),
    scheduled_days: Math.max(sourceInterval, 0),
    learning_steps: 0,
    reps: Math.max(sourceReps, 0),
    lapses: Math.max(sourceLapses, 0),
    state,
    last_review: lastReviewedAt ?? undefined,
  };

  return serializeFsrsCard(card);
}

function toMediaRef(
  filename: string | null,
  mediaByFilename: Map<string, ParsedAnkiMediaRecord>,
  source: StudyAudioSource | 'imported_image' | 'imported_other'
) {
  if (!filename) return null;
  const media = mediaByFilename.get(filename);
  if (!media) {
    return {
      filename,
      mediaKind: getMediaKind(filename),
      source,
      url: null,
    };
  }

  return {
    id: media.id,
    filename: media.filename,
    mediaKind: media.mediaKind,
    source,
    url: `/api/study/media/${encodeURIComponent(media.id)}`,
  };
}

async function toPromptAndAnswerPayload(
  noteTypeName: string,
  templateName: string | null,
  sourceTemplateOrd: number,
  rawFields: JsonRecord,
  mediaByFilename: Map<string, ParsedAnkiMediaRecord>
): Promise<{
  cardType: StudyCardType;
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
  malformedClozeMarkup: boolean;
  promptAudioFilename: string | null;
  answerAudioFilename: string | null;
  imageFilename: string | null;
}> {
  const expression = String(rawFields.Expression ?? rawFields.Text ?? '');
  const expressionReading = String(rawFields.ExpressionReading ?? '');
  const meaning = String(rawFields.Meaning ?? '');
  const notes = String(rawFields.Notes ?? rawFields['Back Extra'] ?? '');
  const photo = String(rawFields.Photo ?? '');
  const audioWord =
    parseAudioFilenames(String(rawFields.AudioWord ?? rawFields.Audio ?? ''))[0] ?? null;
  const audioSentence = parseAudioFilenames(String(rawFields.AudioSentence ?? ''))[0] ?? null;
  const imageFilename = parseImageFilenames(photo)[0] ?? null;

  if (noteTypeName === 'Japanese - Kanji Reading') {
    return {
      cardType: 'recognition',
      prompt: {
        cueText: stripHtml(expression),
        cueReading: stripHtml(expressionReading),
      },
      answer: {
        expression: stripHtml(expression),
        expressionReading: stripHtml(expressionReading),
        meaning: stripHtml(meaning),
        notes: stripHtml(notes),
        answerImage: toMediaRef(imageFilename, mediaByFilename, 'imported_image'),
        answerAudio: toMediaRef(audioWord, mediaByFilename, 'imported'),
      },
      malformedClozeMarkup: false,
      promptAudioFilename: null,
      answerAudioFilename: audioWord,
      imageFilename,
    };
  }

  if (noteTypeName === 'Japanese - Vocab') {
    const isProduction = templateName === 'Image -> Word';
    return {
      cardType: isProduction ? 'production' : 'recognition',
      prompt: isProduction
        ? {
            cueImage: toMediaRef(imageFilename, mediaByFilename, 'imported_image'),
            cueMeaning: stripHtml(meaning),
          }
        : {
            cueText: stripHtml(expression),
            cueReading: stripHtml(expressionReading),
          },
      answer: {
        expression: stripHtml(expression),
        expressionReading: stripHtml(expressionReading),
        meaning: stripHtml(meaning),
        notes: stripHtml(notes),
        sentenceJp: stripHtml(String(rawFields.SentenceJP ?? '')),
        sentenceJpKana: stripHtml(String(rawFields.SentenceJPKana ?? '')),
        sentenceEn: stripHtml(String(rawFields.SentenceEN ?? '')),
        answerImage: toMediaRef(imageFilename, mediaByFilename, 'imported_image'),
        answerAudio: toMediaRef(audioWord ?? audioSentence, mediaByFilename, 'imported'),
      },
      malformedClozeMarkup: false,
      promptAudioFilename: null,
      answerAudioFilename: audioWord ?? audioSentence,
      imageFilename,
    };
  }

  if (noteTypeName === 'Japanese - Listening') {
    return {
      cardType: 'recognition',
      prompt: {
        cueAudio: toMediaRef(audioWord, mediaByFilename, 'imported'),
        cueImage: toMediaRef(imageFilename, mediaByFilename, 'imported_image'),
      },
      answer: {
        expression: stripHtml(expression),
        expressionReading: stripHtml(expressionReading),
        meaning: stripHtml(meaning),
        notes: stripHtml(notes),
        answerImage: toMediaRef(imageFilename, mediaByFilename, 'imported_image'),
        answerAudio: toMediaRef(audioWord, mediaByFilename, 'imported'),
      },
      malformedClozeMarkup: false,
      promptAudioFilename: audioWord,
      answerAudioFilename: audioWord,
      imageFilename,
    };
  }

  if (noteTypeName === 'Cloze') {
    const normalized = await normalizeClozePayload({
      activeOrdinal: sourceTemplateOrd,
      prompt: {
        clozeText: String(rawFields.Text ?? ''),
        clozeHint: stripHtml(String(rawFields.ClozeHint ?? '')),
      },
      answer: {
        restoredText: stripHtml(String(rawFields.AnswerExpression ?? '')),
        meaning: stripHtml(String(rawFields.Meaning ?? '')),
        notes: stripHtml(notes),
        answerAudio: toMediaRef(audioSentence, mediaByFilename, 'imported'),
      },
    });

    return {
      cardType: 'cloze',
      prompt: normalized.prompt,
      answer: normalized.answer,
      malformedClozeMarkup: normalized.malformedMarkup,
      promptAudioFilename: null,
      answerAudioFilename: audioSentence,
      imageFilename: null,
    };
  }

  throw new AppError(`Unsupported note type in ${ANKI_DECK_NAME}: ${noteTypeName}`, 400);
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

export async function getSqlJs() {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({
      locateFile: () => sqlJsWasmPath,
    }).catch((error) => {
      sqlJsPromise = null;
      throw error;
    });
  }

  return sqlJsPromise;
}

interface ZipArchiveReader {
  entryNames: string[];
  readEntryBuffer(entryName: string): Promise<Buffer | null>;
  close(): void;
}

async function openZipArchive(archiveFilePath: string): Promise<ZipArchiveReader> {
  const zipFile = await new Promise<ZipFile>((resolve, reject) => {
    openZipFile(
      archiveFilePath,
      {
        lazyEntries: true,
        autoClose: false,
        // We intentionally inspect and reject unsafe paths ourselves so malformed
        // archive entries become warnings instead of hard parser failures.
        decodeStrings: false,
      },
      (error, handle) => {
        if (error || !handle) {
          reject(error ?? new Error('Failed to open ZIP archive.'));
          return;
        }

        resolve(handle);
      }
    );
  });

  const entriesByName = new Map<string, Entry>();
  const entryNames: string[] = [];

  await new Promise<void>((resolve, reject) => {
    zipFile.on('entry', (entry) => {
      const rawEntryName = Buffer.isBuffer(entry.fileName)
        ? entry.fileName.toString('utf8')
        : entry.fileName;
      const normalizedName = normalizeZipPath(rawEntryName);
      entryNames.push(normalizedName);
      if (!rawEntryName.endsWith('/')) {
        entriesByName.set(normalizedName, entry);
      }
      zipFile.readEntry();
    });
    zipFile.once('end', resolve);
    zipFile.once('error', reject);
    zipFile.readEntry();
  });

  return {
    entryNames,
    async readEntryBuffer(entryName: string) {
      const normalizedName = normalizeZipPath(entryName);
      const entry = entriesByName.get(normalizedName);
      if (!entry) {
        return null;
      }

      return new Promise<Buffer>((resolve, reject) => {
        zipFile.openReadStream(entry, (error, stream) => {
          if (error || !stream) {
            reject(error ?? new Error(`Failed to read ZIP entry "${normalizedName}".`));
            return;
          }

          const chunks: Buffer[] = [];
          stream.on('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          stream.once('end', () => resolve(Buffer.concat(chunks)));
          stream.once('error', reject);
        });
      });
    },
    close() {
      zipFile.close();
    },
  };
}

export async function parseColpkgUpload(params: {
  archiveFilePath: string;
  filename: string;
  userId: string;
  importJobId: string;
}): Promise<ParsedImportDataset> {
  const { archiveFilePath, filename, userId, importJobId } = params;
  const persistedMediaStoragePaths: string[] = [];

  if (!filename.toLowerCase().endsWith('.colpkg')) {
    throw new AppError('Study import requires a .colpkg Anki collection backup.', 400);
  }

  const zip = await openZipArchive(archiveFilePath);
  try {
    const importWarnings = createStudyImportWarningAccumulator();
    let unsafeManifestFilenames = new Set<string>();
    const unsafeArchiveEntriesById = new Map<string, Set<string>>();

    zip.entryNames.forEach((entryName) => {
      if (isAllowedStudyImportZipEntryName(entryName)) {
        return;
      }

      const normalizedEntryName = normalizeZipPath(entryName);
      const basename = path.posix.basename(normalizedEntryName);
      if (isSafeZipBasename(basename)) {
        const existing = unsafeArchiveEntriesById.get(basename) ?? new Set<string>();
        existing.add(normalizedEntryName);
        unsafeArchiveEntriesById.set(basename, existing);
      }
    });

    const collectionBuffer =
      (await zip.readEntryBuffer('collection.anki21b')) ??
      (await zip.readEntryBuffer('collection.anki21')) ??
      (await zip.readEntryBuffer('collection.anki2'));
    if (!collectionBuffer) {
      throw new AppError('The uploaded .colpkg does not contain a collection database.', 400);
    }

    const mediaManifestEntry = await zip.readEntryBuffer('media');
    const mediaManifestBuffer = mediaManifestEntry
      ? await maybeDecompressZstd(mediaManifestEntry, { context: 'media manifest' })
      : Buffer.from('{}');
    const mediaManifest = parseMediaManifest({
      buffer: mediaManifestBuffer,
      importWarnings,
    });
    const manifestMediaByFilename = mediaManifest.mediaByFilename;
    unsafeManifestFilenames = mediaManifest.unsafeManifestFilenames;

    const SQL = await getSqlJs();
    const db = new SQL.Database(
      (await maybeDecompressZstd(collectionBuffer, {
        context: 'collection database',
      })) as Uint8Array
    );

    const collectionRow = mapRows(db.exec('SELECT crt, models, decks FROM col LIMIT 1'))[0];
    if (!collectionRow || typeof collectionRow.crt !== 'number') {
      throw new AppError('The uploaded collection is missing collection metadata.', 400);
    }
    const collectionCreatedAtSeconds = collectionRow.crt;

    const usesNormalizedSchema =
      hasTable(db, 'decks') &&
      hasTable(db, 'notetypes') &&
      hasTable(db, 'fields') &&
      hasTable(db, 'templates');

    let deckId: number;
    let fieldNamesByNoteType: Map<number, string[]>;
    let noteTypeNameById: Map<number, string>;
    let templateNameByNoteTypeAndOrd: Map<string, string>;

    if (usesNormalizedSchema) {
      const deckRows = mapRows(db.exec('SELECT id, name FROM decks'));
      const detectedDeckNames = deckRows
        .map((row) => sanitizeText(String(row.name ?? '')) ?? '')
        .filter((name) => name.length > 0);
      const deckRow = deckRows.find(
        (row) => sanitizeText(String(row.name ?? '')) === ANKI_DECK_NAME
      );
      if (!deckRow || typeof deckRow.id !== 'number') {
        throw toUnsupportedDeckError(detectedDeckNames);
      }

      deckId = deckRow.id;
      const fieldRows = mapRows(db.exec('SELECT ntid, ord, name FROM fields ORDER BY ntid, ord'));
      fieldNamesByNoteType = fieldRows.reduce<Map<number, string[]>>((acc, row) => {
        const noteTypeId = Number(row.ntid);
        const fieldName = sanitizeText(String(row.name ?? '')) ?? '';
        const current = acc.get(noteTypeId) ?? [];
        current.push(fieldName);
        acc.set(noteTypeId, current);
        return acc;
      }, new Map());

      noteTypeNameById = new Map(
        mapRows(db.exec('SELECT id, name FROM notetypes')).map((row) => [
          Number(row.id),
          sanitizeText(String(row.name ?? '')) ?? '',
        ])
      );

      templateNameByNoteTypeAndOrd = new Map(
        mapRows(db.exec('SELECT ntid, ord, name FROM templates')).map((row) => [
          `${Number(row.ntid)}:${Number(row.ord)}`,
          sanitizeText(String(row.name ?? '')) ?? `ord:${Number(row.ord)}`,
        ])
      );
    } else {
      ({ deckId, fieldNamesByNoteType, noteTypeNameById, templateNameByNoteTypeAndOrd } =
        parseLegacyDeckAndModelMetadata(collectionRow));
    }

    const cardRows = mapRows(
      db.exec(
        `
      SELECT
        c.id AS card_id,
        c.nid AS note_id,
        c.did AS deck_id,
        c.ord AS ord,
        c.queue AS queue,
        c.type AS type,
        c.due AS due,
        c.ivl AS ivl,
        c.factor AS factor,
        c.reps AS reps,
        c.lapses AS lapses,
        c.left AS left,
        c.odue AS odue,
        c.odid AS odid,
        c.data AS data,
        n.guid AS note_guid,
        n.mid AS note_type_id,
        n.flds AS note_fields,
        n.tags AS note_tags
      FROM cards c
      JOIN notes n ON n.id = c.nid
      WHERE c.did = $deckId
      ORDER BY c.id ASC
    `,
        { $deckId: deckId }
      )
    ).map<ParsedCardRow>((row) => ({
      cardId: Number(row.card_id),
      noteId: Number(row.note_id),
      deckId: Number(row.deck_id),
      ord: Number(row.ord),
      queue: Number(row.queue),
      type: Number(row.type),
      due: Number(row.due),
      ivl: Number(row.ivl),
      factor: Number(row.factor),
      reps: Number(row.reps),
      lapses: Number(row.lapses),
      left: Number(row.left),
      odue: Number(row.odue),
      odid: Number(row.odid),
      data: sanitizeText(String(row.data ?? '')) ?? '',
      noteGuid: sanitizeText(String(row.note_guid ?? '')) ?? '',
      noteTypeId: Number(row.note_type_id),
      noteFields: sanitizeText(String(row.note_fields ?? '')) ?? '',
      noteTags: sanitizeText(String(row.note_tags ?? '')) ?? '',
      notetypeName: noteTypeNameById.get(Number(row.note_type_id)) ?? '',
      templateName:
        templateNameByNoteTypeAndOrd.get(`${Number(row.note_type_id)}:${Number(row.ord)}`) ?? null,
    }));

    if (cardRows.length === 0) {
      throw new AppError(`Deck "${ANKI_DECK_NAME}" has no cards to import.`, 400);
    }

    const reviewLogRows = mapRows(
      db.exec(
        `
      SELECT
        r.id AS review_id,
        r.cid AS card_id,
        r.ease AS ease,
        r.ivl AS ivl,
        r.lastIvl AS last_ivl,
        r.factor AS factor,
        r.time AS time,
        r.type AS type
      FROM revlog r
      JOIN cards c ON c.id = r.cid
      WHERE c.did = $deckId
      ORDER BY r.id ASC
    `,
        { $deckId: deckId }
      )
    ).map<ParsedReviewLogRow>((row) => ({
      reviewId: Number(row.review_id),
      cardId: Number(row.card_id),
      ease: Number(row.ease),
      ivl: Number(row.ivl),
      lastIvl: Number(row.last_ivl),
      factor: Number(row.factor),
      time: Number(row.time),
      type: Number(row.type),
    }));

    const cardsByNoteId = cardRows.reduce<Map<number, ParsedCardRow[]>>((acc, row) => {
      const current = acc.get(row.noteId) ?? [];
      current.push(row);
      acc.set(row.noteId, current);
      return acc;
    }, new Map());

    const mediaFilenames = new Set<string>();
    for (const row of cardRows) {
      for (const value of row.noteFields.split(FIELD_SEPARATOR)) {
        parseAudioFilenames(value).forEach((media) => mediaFilenames.add(media));
        parseImageFilenames(value).forEach((media) => mediaFilenames.add(media));
      }
    }

    const media: ParsedAnkiMediaRecord[] = [];
    for (const mediaFilename of mediaFilenames) {
      const manifestMedia = manifestMediaByFilename.get(mediaFilename) ?? null;
      const mediaId = manifestMedia?.id ?? null;
      let publicUrl: string | null = null;
      let storagePath: string | null = null;

      if (mediaId && isSafeZipBasename(mediaId) && isSafeZipBasename(mediaFilename)) {
        const mediaEntryBuffer = await zip.readEntryBuffer(mediaId);
        if (mediaEntryBuffer) {
          if (!isAllowedStudyImportZipEntryName(mediaId)) {
            recordStudyImportWarning(
              importWarnings,
              mediaFilename,
              'Skipped unsafe archive entry.'
            );
          } else {
            let persistableMediaBuffer: Buffer | null = mediaEntryBuffer;
            if (mediaManifest.mediaFilesMayBeZstdCompressed) {
              try {
                persistableMediaBuffer = await maybeDecompressZstd(mediaEntryBuffer, {
                  context: `media ${mediaFilename} (${mediaId})`,
                  expectedSize: manifestMedia?.size,
                });
              } catch {
                persistableMediaBuffer = null;
                recordStudyImportWarning(
                  importWarnings,
                  mediaFilename,
                  'Skipped corrupt zstd-compressed media.'
                );
              }
            }

            if (
              persistableMediaBuffer &&
              !hasMatchingSha1(persistableMediaBuffer, manifestMedia?.sha1 ?? null)
            ) {
              persistableMediaBuffer = null;
              recordStudyImportWarning(
                importWarnings,
                mediaFilename,
                'Skipped media with an invalid checksum.'
              );
            }

            if (!persistableMediaBuffer) {
              media.push({
                id: randomUUID(),
                sourceMediaKey: mediaId,
                filename: mediaFilename,
                mediaKind: getMediaKind(mediaFilename),
                contentType: getContentType(mediaFilename),
                publicUrl,
                storagePath,
              });
              continue;
            }

            const persisted = await persistStudyMediaBuffer({
              userId,
              importJobId,
              filename: mediaFilename,
              buffer: persistableMediaBuffer,
            });
            publicUrl = persisted.publicUrl;
            storagePath = persisted.storagePath;
            persistedMediaStoragePaths.push(persisted.storagePath);
          }
        } else {
          recordStudyImportWarning(
            importWarnings,
            mediaFilename,
            unsafeArchiveEntriesById.has(mediaId)
              ? 'Skipped unsafe archive entry.'
              : 'Referenced media was missing.'
          );
        }
      } else if (mediaId || (mediaFilename && !unsafeManifestFilenames.has(mediaFilename))) {
        recordStudyImportWarning(importWarnings, mediaFilename, 'Skipped unsafe media path.');
      }

      if (!mediaId && mediaFilename && !unsafeManifestFilenames.has(mediaFilename)) {
        recordStudyImportWarning(
          importWarnings,
          mediaFilename,
          'Referenced media was missing from the archive manifest.'
        );
      }

      media.push({
        id: randomUUID(),
        sourceMediaKey: mediaId ?? null,
        filename: mediaFilename,
        mediaKind: getMediaKind(mediaFilename),
        contentType: getContentType(mediaFilename),
        publicUrl,
        storagePath,
      });
    }

    const mediaByFilename = new Map(media.map((item) => [item.filename, item]));
    const notes: ParsedImportDataset['notes'] = [];
    const cards: ParsedImportDataset['cards'] = [];
    const noteTypeBreakdownMap = new Map<string, { noteCount: number; cardCount: number }>();

    for (const [noteId, noteCards] of cardsByNoteId.entries()) {
      const firstCard = noteCards[0];
      const fieldNames = fieldNamesByNoteType.get(firstCard.noteTypeId) ?? [];
      const rawFieldValues = firstCard.noteFields.split(FIELD_SEPARATOR);
      const rawFields = Object.fromEntries(
        fieldNames.map((fieldName, index) => [fieldName, rawFieldValues[index] ?? ''])
      );

      const noteCreateId = randomUUID();
      notes.push({
        createId: noteCreateId,
        sourceNoteId: noteId,
        sourceGuid: firstCard.noteGuid,
        sourceDeckId: firstCard.deckId,
        sourceNotetypeId: firstCard.noteTypeId,
        sourceNotetypeName: firstCard.notetypeName,
        rawFields,
        canonical: {
          tags: firstCard.noteTags,
          availableCardTypes: noteCards.map((row) => row.templateName ?? `ord:${row.ord}`),
        },
      });

      const breakdown = noteTypeBreakdownMap.get(firstCard.notetypeName) ?? {
        noteCount: 0,
        cardCount: 0,
      };
      breakdown.noteCount += 1;
      breakdown.cardCount += noteCards.length;
      noteTypeBreakdownMap.set(firstCard.notetypeName, breakdown);

      for (const noteCard of noteCards) {
        const promptAndAnswer = await toPromptAndAnswerPayload(
          firstCard.notetypeName,
          noteCard.templateName,
          noteCard.ord,
          rawFields,
          mediaByFilename
        );
        const sourceFsrs = parseJsonRecord(noteCard.data);
        const queueState = toQueueState(noteCard.queue, noteCard.type);
        const dueAt = toDueAt(
          collectionCreatedAtSeconds,
          noteCard.queue,
          noteCard.type,
          noteCard.due
        );
        const lastReviewedAt = toLastReviewedAt(sourceFsrs, dueAt, noteCard.ivl);
        const schedulerState = toSchedulerState(
          sourceFsrs,
          dueAt,
          queueState,
          noteCard.ivl,
          noteCard.reps,
          noteCard.lapses,
          lastReviewedAt
        );

        cards.push({
          createId: randomUUID(),
          noteCreateId,
          sourceCardId: noteCard.cardId,
          sourceDeckId: noteCard.deckId,
          sourceTemplateOrd: noteCard.ord,
          sourceTemplateName: noteCard.templateName,
          sourceQueue: noteCard.queue,
          sourceCardType: noteCard.type,
          sourceDue: noteCard.due,
          sourceInterval: noteCard.ivl,
          sourceFactor: noteCard.factor,
          sourceReps: noteCard.reps,
          sourceLapses: noteCard.lapses,
          sourceLeft: noteCard.left,
          sourceOriginalDue: noteCard.odue,
          sourceOriginalDeckId: noteCard.odid,
          sourceFsrs,
          cardType: promptAndAnswer.cardType,
          queueState,
          dueAt,
          lastReviewedAt,
          prompt: promptAndAnswer.prompt,
          answer: promptAndAnswer.answer,
          schedulerState,
          answerAudioSource: promptAndAnswer.answerAudioFilename ? 'imported' : 'missing',
          promptAudioMediaFilename: promptAndAnswer.promptAudioFilename,
          answerAudioMediaFilename: promptAndAnswer.answerAudioFilename,
          imageMediaFilename: promptAndAnswer.imageFilename,
        });

        if (promptAndAnswer.cardType === 'cloze' && promptAndAnswer.malformedClozeMarkup) {
          recordStudyImportWarning(
            importWarnings,
            `note ${String(noteId)} / card ${String(noteCard.cardId)}`,
            'Recovered malformed cloze markup as plain text.',
            { countsAsSkippedMedia: false }
          );
        }
      }
    }

    const reviewLogs: ParsedImportDataset['reviewLogs'] = reviewLogRows.map((row) => ({
      createId: randomUUID(),
      sourceReviewId: row.reviewId,
      sourceCardId: row.cardId,
      reviewedAt: new Date(row.reviewId),
      rating: row.ease,
      sourceEase: row.ease,
      sourceInterval: row.ivl,
      sourceLastInterval: row.lastIvl,
      sourceFactor: row.factor,
      sourceTimeMs: row.time,
      sourceReviewType: row.type,
    }));

    return {
      collectionCreatedAtSeconds,
      preview: {
        deckName: ANKI_DECK_NAME,
        cardCount: cards.length,
        noteCount: notes.length,
        reviewLogCount: reviewLogs.length,
        mediaReferenceCount: media.length,
        skippedMediaCount: importWarnings.skippedMediaCount,
        warnings: importWarnings.warnings,
        noteTypeBreakdown: Array.from(noteTypeBreakdownMap.entries()).map(
          ([notetypeName, stats]) => ({
            notetypeName,
            noteCount: stats.noteCount,
            cardCount: stats.cardCount,
          })
        ),
      },
      mediaByFilename,
      persistedMediaStoragePaths,
      notes,
      cards,
      reviewLogs,
      media,
    };
  } catch (error) {
    if (error instanceof AppError) {
      (error as { persistedMediaStoragePaths?: string[] }).persistedMediaStoragePaths = [
        ...persistedMediaStoragePaths,
      ];
      throw error;
    }

    const parseError = new AppError('The uploaded .colpkg could not be parsed.', 400);
    (parseError as { persistedMediaStoragePaths?: string[] }).persistedMediaStoragePaths = [
      ...persistedMediaStoragePaths,
    ];
    throw parseError;
  } finally {
    zip.close();
  }
}
