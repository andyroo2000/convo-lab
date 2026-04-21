import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { createRequire } from 'module';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { zstdDecompressSync } from 'zlib';

import { DEFAULT_NARRATOR_VOICES } from '@languageflow/shared/src/constants-new.js';
import type {
  StudyAnswerPayload,
  StudyCardActionName,
  StudyCardActionResult,
  StudyCardOption,
  StudyCardOptionsResponse,
  StudyCardSetDueMode,
  StudyAudioSource,
  StudyBrowserCardStats,
  StudyBrowserField,
  StudyBrowserFilterOptions,
  StudyBrowserListResponse,
  StudyBrowserNoteDetail,
  StudyBrowserRow,
  StudyCardState,
  StudyCardSummary,
  StudyCardType,
  StudyExportManifest,
  StudyFsrsState,
  StudyImportPreview,
  StudyImportResult,
  StudyMediaRef,
  StudyOverview,
  StudyPromptPayload,
  StudyQueueState,
  StudyReviewEvent,
  StudyReviewResult,
  StudyUndoReviewResult,
} from '@languageflow/shared/src/types.js';
import { Prisma } from '@prisma/client';
import { decode } from 'html-entities';
import { parseDocument } from 'htmlparser2';
import JSZip from 'jszip';
import initSqlJs, { type Database, type QueryExecResult } from 'sql.js';
import { fsrs, Rating, State, type Card, type Grade } from 'ts-fsrs';

import { prisma } from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';

import { addFuriganaBrackets } from './furiganaService.js';
import { uploadToGCS } from './storageClient.js';
import { synthesizeSpeech } from './ttsClient.js';

const require = createRequire(import.meta.url);
const sqlJsWasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scheduler = fsrs();
const ANKI_DECK_NAME = '日本語';
const FIELD_SEPARATOR = String.fromCharCode(31);
const DEFAULT_STUDY_LIMIT = 20;

type JsonRecord = Record<string, unknown>;
type StudyMediaRecord = Prisma.StudyMediaGetPayload<Prisma.StudyMediaDefaultArgs>;
type StudyImportJobRecord = Prisma.StudyImportJobGetPayload<Prisma.StudyImportJobDefaultArgs>;
type StudyReviewLogRecord = Prisma.StudyReviewLogGetPayload<Prisma.StudyReviewLogDefaultArgs>;
type StudyCardWithRelations = Prisma.StudyCardGetPayload<{
  include: {
    note: true;
    promptAudioMedia: true;
    answerAudioMedia: true;
    imageMedia: true;
  };
}>;
type StudyCardOptionRecord = Prisma.StudyCardGetPayload<{
  select: {
    id: true;
    promptJson: true;
    answerJson: true;
    updatedAt: true;
  };
}>;
type StudyBrowserListCardRecord = Prisma.StudyCardGetPayload<{
  select: {
    id: true;
    cardType: true;
    queueState: true;
    promptJson: true;
    answerJson: true;
    updatedAt: true;
  };
}>;
type StudyBrowserListNoteRecord = Prisma.StudyNoteGetPayload<{
  include: {
    cards: {
      select: {
        id: true;
        cardType: true;
        queueState: true;
        promptJson: true;
        answerJson: true;
        updatedAt: true;
      };
    };
  };
}>;
type StudyBrowserDetailNoteRecord = Prisma.StudyNoteGetPayload<{
  include: {
    cards: {
      include: {
        note: true;
        promptAudioMedia: true;
        answerAudioMedia: true;
        imageMedia: true;
      };
    };
  };
}>;

interface QueryRow {
  [key: string]: string | number | Uint8Array | null;
}

interface ParsedAnkiMediaRecord {
  id: string;
  sourceMediaKey: string | null;
  filename: string;
  mediaKind: 'audio' | 'image' | 'other';
  contentType: string;
  publicUrl: string | null;
  storagePath: string | null;
}

interface PersistedStudyMediaRecord {
  id: string;
  userId: string;
  importJobId?: string | null;
  sourceKind?: string | null;
  normalizedFilename?: string | null;
  sourceFilename?: string | null;
  mediaKind?: string | null;
  storagePath?: string | null;
  publicUrl?: string | null;
}

interface ParsedCardRow {
  cardId: number;
  noteId: number;
  deckId: number;
  ord: number;
  queue: number;
  type: number;
  due: number;
  ivl: number;
  factor: number;
  reps: number;
  lapses: number;
  left: number;
  odue: number;
  odid: number;
  data: string;
  noteGuid: string;
  noteTypeId: number;
  noteFields: string;
  noteTags: string;
  notetypeName: string;
  templateName: string | null;
}

interface ParsedReviewLogRow {
  reviewId: number;
  cardId: number;
  ease: number;
  ivl: number;
  lastIvl: number;
  factor: number;
  time: number;
  type: number;
}

interface ParsedImportDataset {
  collectionCreatedAtSeconds: number;
  preview: StudyImportPreview;
  mediaByFilename: Map<string, ParsedAnkiMediaRecord>;
  notes: Array<{
    createId: string;
    sourceNoteId: number;
    sourceGuid: string;
    sourceDeckId: number;
    sourceNotetypeId: number;
    sourceNotetypeName: string;
    rawFields: JsonRecord;
    canonical: JsonRecord;
  }>;
  cards: Array<{
    createId: string;
    noteCreateId: string;
    sourceCardId: number;
    sourceDeckId: number;
    sourceTemplateOrd: number;
    sourceTemplateName: string | null;
    sourceQueue: number;
    sourceCardType: number;
    sourceDue: number;
    sourceInterval: number;
    sourceFactor: number;
    sourceReps: number;
    sourceLapses: number;
    sourceLeft: number;
    sourceOriginalDue: number;
    sourceOriginalDeckId: number;
    sourceFsrs: JsonRecord | null;
    cardType: StudyCardType;
    queueState: StudyQueueState;
    dueAt: Date | null;
    lastReviewedAt: Date | null;
    prompt: StudyPromptPayload;
    answer: StudyAnswerPayload;
    schedulerState: StudyFsrsState | null;
    answerAudioSource: StudyAudioSource;
    promptAudioMediaFilename: string | null;
    answerAudioMediaFilename: string | null;
    imageMediaFilename: string | null;
  }>;
  reviewLogs: Array<{
    createId: string;
    sourceReviewId: number;
    sourceCardId: number;
    reviewedAt: Date;
    rating: number;
    sourceEase: number;
    sourceInterval: number;
    sourceLastInterval: number;
    sourceFactor: number;
    sourceTimeMs: number;
    sourceReviewType: number;
  }>;
  media: ParsedAnkiMediaRecord[];
}

interface CreateStudyCardInput {
  userId: string;
  cardType: StudyCardType;
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
}

interface UpdateStudyCardInput {
  userId: string;
  cardId: string;
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
}

interface PerformStudyCardActionInput {
  userId: string;
  cardId: string;
  action: StudyCardActionName;
  mode?: StudyCardSetDueMode;
  dueAt?: string;
}

let sqlJsPromise: Promise<Awaited<ReturnType<typeof initSqlJs>>> | null = null;

interface LegacyDeckConfig {
  id?: number;
  name?: string;
}

interface LegacyFieldConfig {
  ord?: number;
  name?: string;
}

interface LegacyTemplateConfig {
  ord?: number;
  name?: string;
}

interface LegacyModelConfig {
  id?: number;
  name?: string;
  flds?: LegacyFieldConfig[];
  tmpls?: LegacyTemplateConfig[];
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function stripNullChars(value: string): string {
  return value.replaceAll('\0', '');
}

function sanitizeText(value: string | null | undefined): string | null {
  if (value === null || typeof value === 'undefined') return null;
  return stripNullChars(value);
}

function sanitizeJsonValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return stripNullChars(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonValue(item));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeJsonValue(item)])
    );
  }

  return value;
}

function isZstdCompressed(buffer: Buffer | Uint8Array): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x28 &&
    buffer[1] === 0xb5 &&
    buffer[2] === 0x2f &&
    buffer[3] === 0xfd
  );
}

function maybeDecompressZstd(buffer: Buffer): Buffer {
  return isZstdCompressed(buffer) ? zstdDecompressSync(buffer) : buffer;
}

function toFsrsDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function serializeFsrsCard(card: Card): StudyFsrsState {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.toISOString() : null,
  };
}

function deserializeFsrsCard(state: StudyFsrsState | JsonRecord | null | undefined): Card | null {
  if (!state || !isRecord(state)) return null;
  if (typeof state.due !== 'string') return null;
  const due = new Date(state.due);
  if (Number.isNaN(due.getTime())) return null;

  const stability = typeof state.stability === 'number' ? state.stability : null;
  const difficulty = typeof state.difficulty === 'number' ? state.difficulty : null;
  const elapsedDays = typeof state.elapsed_days === 'number' ? state.elapsed_days : null;
  const scheduledDays = typeof state.scheduled_days === 'number' ? state.scheduled_days : null;
  const learningSteps = typeof state.learning_steps === 'number' ? state.learning_steps : null;
  const reps = typeof state.reps === 'number' ? state.reps : null;
  const lapses = typeof state.lapses === 'number' ? state.lapses : null;
  const stateValue = typeof state.state === 'number' ? state.state : null;
  const rawLastReview = state.last_review;
  let lastReview: string | null | undefined;
  if (typeof rawLastReview === 'string') {
    lastReview = rawLastReview;
  } else if (rawLastReview === null) {
    lastReview = null;
  } else {
    lastReview = undefined;
  }

  if (
    stability === null ||
    difficulty === null ||
    elapsedDays === null ||
    scheduledDays === null ||
    learningSteps === null ||
    reps === null ||
    lapses === null ||
    stateValue === null
  ) {
    return null;
  }

  return {
    due,
    stability,
    difficulty,
    elapsed_days: elapsedDays,
    scheduled_days: scheduledDays,
    learning_steps: learningSteps,
    reps,
    lapses,
    state: stateValue,
    last_review: toFsrsDate(lastReview),
  };
}

function createFreshSchedulerState(
  due: Date = new Date(),
  state: State = State.New
): StudyFsrsState {
  return serializeFsrsCard({
    due,
    stability: 0.1,
    difficulty: 5,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    state,
    last_review: undefined,
  });
}

function dateFromDayBoundary(daysFromToday: number): Date {
  const date = new Date();
  date.setHours(9, 0, 0, 0);
  date.setDate(date.getDate() + daysFromToday);
  return date;
}

function getScheduledDaysForDue(dueAt: Date, from: Date = new Date()): number {
  return Math.max(0, Math.round((dueAt.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
}

function normalizeFilename(filename: string): string {
  const base = path.basename(stripNullChars(filename));
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function sanitizePathSegment(value: string): string {
  const base = path.basename(stripNullChars(value));
  const normalized = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  return normalized.length > 0 ? normalized : 'unknown';
}

interface ParsedHtmlNode {
  type?: string;
  name?: string;
  data?: string;
  children?: ParsedHtmlNode[];
}

const BLOCK_LEVEL_TAGS = new Set([
  'p',
  'div',
  'blockquote',
  'section',
  'article',
  'header',
  'footer',
  'li',
  'ul',
  'ol',
]);

function collectHtmlText(node: ParsedHtmlNode, output: string[]) {
  if (node.type === 'text' || node.type === 'cdata') {
    output.push(node.data ?? '');
    return;
  }

  if (node.type === 'comment') {
    return;
  }

  const name = (node.name ?? '').toLowerCase();
  if (name === 'br') {
    output.push('\n');
    return;
  }

  for (const child of node.children ?? []) {
    collectHtmlText(child, output);
  }

  if (BLOCK_LEVEL_TAGS.has(name)) {
    output.push('\n');
  }
}

function collapsePlainText(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function htmlToPlainText(raw: string): string {
  const document = parseDocument(stripNullChars(raw));
  const output: string[] = [];

  for (const child of document.children as ParsedHtmlNode[]) {
    collectHtmlText(child, output);
  }

  return collapsePlainText(decode(output.join('')));
}

function stripHtml(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return htmlToPlainText(raw);
}

function parsePersistedStudyMediaRecord(value: unknown): PersistedStudyMediaRecord | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || typeof value.userId !== 'string') return null;

  return {
    id: value.id,
    userId: value.userId,
    importJobId: typeof value.importJobId === 'string' ? value.importJobId : null,
    sourceKind: typeof value.sourceKind === 'string' ? value.sourceKind : null,
    normalizedFilename:
      typeof value.normalizedFilename === 'string' ? value.normalizedFilename : null,
    sourceFilename: typeof value.sourceFilename === 'string' ? value.sourceFilename : null,
    mediaKind: typeof value.mediaKind === 'string' ? value.mediaKind : null,
    storagePath: typeof value.storagePath === 'string' ? value.storagePath : null,
    publicUrl: typeof value.publicUrl === 'string' ? value.publicUrl : null,
  };
}

function getMediaPublicUrl(media: unknown): string | null {
  if (!isRecord(media)) return null;
  if (typeof media.publicUrl === 'string' && media.publicUrl.length > 0) {
    return media.publicUrl;
  }
  if (typeof media.storagePath === 'string' && media.storagePath.length > 0) {
    return `/${media.storagePath}`;
  }
  return null;
}

function hydrateMediaRef(
  mediaRef: StudyMediaRef | null | undefined,
  media: unknown
): StudyMediaRef | null | undefined {
  if (!mediaRef && !media) return mediaRef;

  const resolvedUrl = getMediaPublicUrl(media);
  if (!resolvedUrl) return mediaRef;
  const mediaRecord = isRecord(media) ? media : null;

  return {
    ...(mediaRef ?? {
      filename:
        typeof mediaRecord?.sourceFilename === 'string'
          ? mediaRecord.sourceFilename
          : typeof mediaRecord?.normalizedFilename === 'string'
            ? mediaRecord.normalizedFilename
            : 'media',
      mediaKind:
        typeof mediaRecord?.mediaKind === 'string'
          ? (mediaRecord.mediaKind as StudyMediaRef['mediaKind'])
          : 'other',
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

function getDefaultAnkiMediaDirectory(): string | null {
  const defaultDir = path.join(
    os.homedir(),
    'Library',
    'Application Support',
    'Anki2',
    'User 1',
    'collection.media'
  );
  return defaultDir;
}

async function findLocalAnkiMediaFile(filename: string): Promise<string | null> {
  const configuredDir = sanitizeText(process.env.ANKI_MEDIA_DIR ?? '');
  const safeFilename = path.basename(stripNullChars(filename));
  const candidateDirs = [configuredDir, getDefaultAnkiMediaDirectory()].filter(
    (value): value is string => Boolean(value)
  );

  for (const dir of candidateDirs) {
    const absolutePath = path.join(dir, safeFilename);
    try {
      await fs.access(absolutePath);
      return absolutePath;
    } catch {
      continue;
    }
  }

  return null;
}

function getContentType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'application/octet-stream';
}

function getMediaKind(filename: string): 'audio' | 'image' | 'other' {
  const contentType = getContentType(filename);
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType.startsWith('image/')) return 'image';
  return 'other';
}

function parseAudioFilenames(value: string): string[] {
  return Array.from(stripNullChars(value).matchAll(/\[sound:([^\]]+)\]/g), (match) => match[1])
    .map((filename) => stripNullChars(filename))
    .filter(Boolean);
}

function parseImageFilenames(value: string): string[] {
  return Array.from(stripNullChars(value).matchAll(/<img[^>]+src=["']([^"']+)["']/gi), (match) =>
    stripNullChars(match[1])
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

function parseAnkiClozeText(
  rawText: string,
  activeOrdinal: number,
  fallbackHint: string | null
): {
  displayText: string | null;
  answerText: string | null;
  restoredText: string | null;
  resolvedHint: string | null;
} {
  const activeClozeIndex = activeOrdinal + 1;
  let activeAnswerText: string | null = null;
  let inlineHint: string | null = null;
  const restoredParts: string[] = [];
  const displayParts: string[] = [];
  const source = stripNullChars(rawText);
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
      break;
    }

    const rawToken = source.slice(tokenStart, tokenEnd + 2);
    const token = parseClozeToken(rawToken);
    if (!token) {
      restoredParts.push(rawToken);
      displayParts.push(rawToken);
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
  };
}

async function normalizeClozePayload(params: {
  activeOrdinal: number;
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
}): Promise<{
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
}> {
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
  } else {
    clozeDisplayText = clozeDisplayText ?? stripHtml(rawClozeText);
    resolvedHint = resolvedHint ?? fallbackHint;
  }

  const restoredTextReading = restoredText ? await addFuriganaBrackets(restoredText) : null;

  return {
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

function mapRows(result: QueryExecResult[]): QueryRow[] {
  if (result.length === 0) return [];
  const [{ columns, values }] = result;
  return values.map((valueRow) =>
    Object.fromEntries(columns.map((column, index) => [column, valueRow[index] ?? null]))
  );
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return sanitizeJsonValue(value) as Prisma.InputJsonValue;
}

function toNullablePrismaJson(
  value: unknown
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (typeof value === 'undefined') return undefined;
  if (value === null) return Prisma.JsonNull;
  return sanitizeJsonValue(value) as Prisma.InputJsonValue;
}

function toBigIntOrNull(value: number | null | undefined): bigint | null {
  return typeof value === 'number' ? BigInt(value) : null;
}

function parseJsonRecord(raw: string): JsonRecord | null {
  if (!raw || raw === '{}') return null;
  try {
    const parsed = JSON.parse(stripNullChars(raw)) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function hasTable(db: Database, tableName: string): boolean {
  const rows = mapRows(
    db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name = $tableName LIMIT 1", {
      $tableName: tableName,
    })
  );
  return rows.length > 0;
}

function parseLegacyDeckAndModelMetadata(collectionRow: QueryRow): {
  deckId: number;
  fieldNamesByNoteType: Map<number, string[]>;
  noteTypeNameById: Map<number, string>;
  templateNameByNoteTypeAndOrd: Map<string, string>;
} {
  const decksRaw =
    typeof collectionRow.decks === 'string' ? stripNullChars(collectionRow.decks) : '{}';
  const modelsRaw =
    typeof collectionRow.models === 'string' ? stripNullChars(collectionRow.models) : '{}';

  const decks = JSON.parse(decksRaw) as Record<string, LegacyDeckConfig>;
  const models = JSON.parse(modelsRaw) as Record<string, LegacyModelConfig>;

  const targetDeck = Object.values(decks).find((deck) => deck?.name === ANKI_DECK_NAME);
  if (!targetDeck || typeof targetDeck.id !== 'number') {
    throw new AppError(`Deck "${ANKI_DECK_NAME}" was not found in the uploaded collection.`, 400);
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
): StudyFsrsState | null {
  if (!dueAt && queueState !== 'new') {
    return null;
  }

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
    difficulty: clamp(typeof sourceFsrs?.d === 'number' ? sourceFsrs.d : 5, 1, 10),
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
): StudyMediaRef | null {
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
    url: media.publicUrl,
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
        cueHtml: expression,
        cueReading: stripHtml(expressionReading),
      },
      answer: {
        expression: stripHtml(expression),
        expressionReading: stripHtml(expressionReading),
        meaning: stripHtml(meaning),
        notes,
        answerImage: toMediaRef(imageFilename, mediaByFilename, 'imported_image'),
        answerAudio: toMediaRef(audioWord, mediaByFilename, 'imported'),
      },
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
            cueHtml: expression,
            cueReading: stripHtml(expressionReading),
          },
      answer: {
        expression: stripHtml(expression),
        expressionReading: stripHtml(expressionReading),
        meaning: stripHtml(meaning),
        notes,
        sentenceJp: stripHtml(String(rawFields.SentenceJP ?? '')),
        sentenceJpKana: stripHtml(String(rawFields.SentenceJPKana ?? '')),
        sentenceEn: stripHtml(String(rawFields.SentenceEN ?? '')),
        answerImage: toMediaRef(imageFilename, mediaByFilename, 'imported_image'),
        answerAudio: toMediaRef(audioWord ?? audioSentence, mediaByFilename, 'imported'),
      },
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
        notes,
        answerImage: toMediaRef(imageFilename, mediaByFilename, 'imported_image'),
        answerAudio: toMediaRef(audioWord, mediaByFilename, 'imported'),
      },
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
        notes,
        answerAudio: toMediaRef(audioSentence, mediaByFilename, 'imported'),
      },
    });

    return {
      cardType: 'cloze',
      prompt: normalized.prompt,
      answer: normalized.answer,
      promptAudioFilename: null,
      answerAudioFilename: audioSentence,
      imageFilename: null,
    };
  }

  throw new AppError(`Unsupported note type in ${ANKI_DECK_NAME}: ${noteTypeName}`, 400);
}

function getBestAnswerAudioText(answer: StudyAnswerPayload): string | null {
  return answer.expression ?? answer.restoredText ?? answer.sentenceJp ?? answer.meaning ?? null;
}

async function getSqlJs() {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({
      locateFile: () => sqlJsWasmPath,
    });
  }

  return sqlJsPromise;
}

async function persistStudyMediaBuffer(params: {
  userId: string;
  importJobId: string;
  filename: string;
  buffer: Buffer;
}): Promise<{ publicUrl: string; storagePath: string }> {
  const { userId, importJobId, filename, buffer } = params;
  const normalizedFilename = normalizeFilename(filename);
  const storagePath = path.posix.join(
    'study-media',
    sanitizePathSegment(userId),
    sanitizePathSegment(importJobId),
    normalizedFilename
  );

  if (process.env.GCS_BUCKET_NAME) {
    try {
      const publicUrl = await uploadToGCS({
        buffer,
        filename: normalizedFilename,
        contentType: getContentType(filename),
        folder: path.posix.dirname(storagePath),
      });

      return {
        publicUrl,
        storagePath,
      };
    } catch (error) {
      console.warn('[Study] Falling back to local media storage:', error);
    }
  }

  const absolutePath = path.join(__dirname, '../../public', storagePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer);

  return {
    publicUrl: `/${storagePath}`,
    storagePath,
  };
}

async function parseColpkgUpload(params: {
  fileBuffer: Buffer;
  filename: string;
  userId: string;
  importJobId: string;
}): Promise<ParsedImportDataset> {
  const { fileBuffer, filename, userId, importJobId } = params;

  if (!filename.toLowerCase().endsWith('.colpkg')) {
    throw new AppError('Study import requires a .colpkg Anki collection backup.', 400);
  }

  try {
    const zip = await JSZip.loadAsync(fileBuffer);
    const collectionEntry =
      zip.file('collection.anki21b') ??
      zip.file('collection.anki21') ??
      zip.file('collection.anki2');
    if (!collectionEntry) {
      throw new AppError('The uploaded .colpkg does not contain a collection database.', 400);
    }

    const mediaManifestEntry = zip.file('media');
    const mediaManifestBuffer = mediaManifestEntry
      ? maybeDecompressZstd(await mediaManifestEntry.async('nodebuffer'))
      : Buffer.from('{}');
    const mediaManifestText = mediaManifestBuffer.length
      ? mediaManifestBuffer.toString('utf8')
      : '{}';
    const mediaManifest = JSON.parse(mediaManifestText) as Record<string, string>;
    const mediaIdByFilename = new Map<string, string>(
      Object.entries(mediaManifest).map(([id, mediaFilename]) => [mediaFilename, id])
    );

    const SQL = await getSqlJs();
    const db = new SQL.Database(
      maybeDecompressZstd(await collectionEntry.async('nodebuffer')) as Uint8Array
    );

    const collectionRow = mapRows(db.exec('SELECT crt, models, decks FROM col LIMIT 1'))[0] as
      | QueryRow
      | undefined;

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
      const deckRow = mapRows(db.exec('SELECT id, name FROM decks')).find(
        (row) => sanitizeText(String(row.name ?? '')) === ANKI_DECK_NAME
      ) as QueryRow | undefined;

      if (!deckRow || typeof deckRow.id !== 'number') {
        throw new AppError(
          `Deck "${ANKI_DECK_NAME}" was not found in the uploaded collection.`,
          400
        );
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
        {
          $deckId: deckId,
        }
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
        {
          $deckId: deckId,
        }
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
      const mediaId = mediaIdByFilename.get(mediaFilename);
      let publicUrl: string | null = null;
      let storagePath: string | null = null;

      if (mediaId) {
        const mediaEntry = zip.file(mediaId);
        if (mediaEntry) {
          const persisted = await persistStudyMediaBuffer({
            userId,
            importJobId,
            filename: mediaFilename,
            buffer: await mediaEntry.async('nodebuffer'),
          });
          publicUrl = persisted.publicUrl;
          storagePath = persisted.storagePath;
        }
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
        noteTypeBreakdown: Array.from(noteTypeBreakdownMap.entries()).map(
          ([notetypeName, stats]) => ({
            notetypeName,
            noteCount: stats.noteCount,
            cardCount: stats.cardCount,
          })
        ),
      },
      mediaByFilename,
      notes,
      cards,
      reviewLogs,
      media,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError('The uploaded .colpkg could not be parsed.', 400);
  }
}

async function normalizeStudyCardPayload(record: StudyCardWithRelations): Promise<{
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
}> {
  let prompt = ((record.promptJson as StudyPromptPayload | null) ?? {}) as StudyPromptPayload;
  let answer = ((record.answerJson as StudyAnswerPayload | null) ?? {}) as StudyAnswerPayload;

  prompt = {
    ...prompt,
    cueAudio: hydrateMediaRef(prompt.cueAudio, record.promptAudioMedia) ?? prompt.cueAudio,
    cueImage: hydrateMediaRef(prompt.cueImage, record.imageMedia) ?? prompt.cueImage,
  };
  answer = {
    ...answer,
    answerAudio: hydrateMediaRef(answer.answerAudio, record.answerAudioMedia) ?? answer.answerAudio,
    answerImage: hydrateMediaRef(answer.answerImage, record.imageMedia) ?? answer.answerImage,
  };

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

async function toStudyCardSummary(record: StudyCardWithRelations): Promise<StudyCardSummary> {
  const noteRecord = record.note;
  const normalized = await normalizeStudyCardPayload(record);

  const state: StudyCardState = {
    dueAt: record.dueAt instanceof Date ? record.dueAt.toISOString() : null,
    queueState: String(record.queueState) as StudyQueueState,
    scheduler: toStudyFsrsState(record.schedulerStateJson),
    source: {
      noteId: typeof noteRecord.sourceNoteId === 'bigint' ? String(noteRecord.sourceNoteId) : null,
      noteGuid: typeof noteRecord.sourceGuid === 'string' ? String(noteRecord.sourceGuid) : null,
      cardId: typeof record.sourceCardId === 'bigint' ? String(record.sourceCardId) : null,
      deckId: typeof record.sourceDeckId === 'bigint' ? String(record.sourceDeckId) : null,
      deckName: typeof record.sourceDeckName === 'string' ? record.sourceDeckName : ANKI_DECK_NAME,
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
  };

  return {
    id: record.id,
    noteId: record.noteId,
    cardType: record.cardType as StudyCardType,
    prompt: normalized.prompt,
    answer: normalized.answer,
    state,
    answerAudioSource: record.answerAudioSource as StudyAudioSource,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function noteFieldValueToString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || typeof value === 'undefined') return null;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getNoteDisplayText(
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

function toStudyImportPreview(value: Prisma.JsonValue | null | undefined): StudyImportPreview {
  return (
    (value as unknown as StudyImportPreview | null) ?? {
      deckName: ANKI_DECK_NAME,
      cardCount: 0,
      noteCount: 0,
      reviewLogCount: 0,
      mediaReferenceCount: 0,
      noteTypeBreakdown: [],
    }
  );
}

function toStudyFsrsState(value: Prisma.JsonValue | null | undefined): StudyFsrsState | null {
  return (value as unknown as StudyFsrsState | null) ?? null;
}

function mergeStudyMediaRecord(
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

function buildMediaLookup(cards: StudyCardSummary[]): Map<string, StudyMediaRef> {
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

function toStudyBrowserField(
  name: string,
  value: unknown,
  mediaLookup: Map<string, StudyMediaRef>
): StudyBrowserField {
  const stringValue = noteFieldValueToString(value);
  const audio = stringValue
    ? (parseAudioFilenames(stringValue)
        .map((filename) => mediaLookup.get(filename))
        .find((entry): entry is StudyMediaRef => Boolean(entry)) ?? null)
    : null;
  const image = stringValue
    ? (parseImageFilenames(stringValue)
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

async function ensureGeneratedAnswerAudio(userId: string, cardId: string): Promise<void> {
  const card = await prisma.studyCard.findUnique({
    where: { id: cardId },
  });

  if (!card || card.userId !== userId) {
    return;
  }

  const answer = (card.answerJson as StudyAnswerPayload) ?? {};
  const existingAnswerAudio = answer.answerAudio;
  const hasPlayableImportedAudio =
    existingAnswerAudio !== null &&
    typeof existingAnswerAudio === 'object' &&
    typeof existingAnswerAudio.url === 'string' &&
    existingAnswerAudio.url.length > 0;

  if (String(card.answerAudioSource) !== 'missing' && hasPlayableImportedAudio) {
    return;
  }

  const text = getBestAnswerAudioText(answer);
  if (!text) {
    return;
  }

  const audioBuffer = await synthesizeSpeech({
    text,
    voiceId: DEFAULT_NARRATOR_VOICES.ja,
    languageCode: 'ja-JP',
    speed: 1.0,
  });

  const filename = `${normalizeFilename(cardId)}.mp3`;
  const persisted = await persistStudyMediaBuffer({
    userId,
    importJobId: 'generated',
    filename,
    buffer: audioBuffer,
  });

  const mediaRecord = await prisma.studyMedia.create({
    data: {
      userId,
      sourceKind: 'generated',
      sourceFilename: filename,
      normalizedFilename: normalizeFilename(filename),
      mediaKind: 'audio',
      contentType: 'audio/mpeg',
      storagePath: persisted.storagePath,
      publicUrl: persisted.publicUrl,
    },
  });

  const nextAnswer: StudyAnswerPayload = {
    ...answer,
    answerAudio: {
      id: mediaRecord.id,
      filename,
      url: persisted.publicUrl,
      mediaKind: 'audio',
      source: 'generated',
    },
  };

  await prisma.studyCard.update({
    where: { id: cardId },
    data: {
      answerJson: toPrismaJson(nextAnswer),
      answerAudioSource: 'generated',
      answerAudioMediaId: mediaRecord.id,
    },
  });
}

async function backfillImportedStudyMedia(
  media: PersistedStudyMediaRecord
): Promise<PersistedStudyMediaRecord | null> {
  if (
    media.sourceKind !== 'anki_import' ||
    !media.id ||
    !media.userId ||
    !media.sourceFilename ||
    getMediaPublicUrl(media)
  ) {
    return media;
  }

  const localMediaFile = await findLocalAnkiMediaFile(media.sourceFilename);
  if (!localMediaFile) {
    return media;
  }

  const persisted = await persistStudyMediaBuffer({
    userId: media.userId,
    importJobId: media.importJobId ?? 'anki-local-media',
    filename: media.sourceFilename,
    buffer: await fs.readFile(localMediaFile),
  });

  return parsePersistedStudyMediaRecord(
    await prisma.studyMedia.update({
      where: { id: media.id },
      data: {
        storagePath: persisted.storagePath,
        publicUrl: persisted.publicUrl,
      },
    })
  );
}

async function ensureStudyCardMediaAvailable(cards: StudyCardWithRelations[]): Promise<void> {
  const mediaRecords = cards.flatMap((card) => {
    const collected: PersistedStudyMediaRecord[] = [];
    const promptAudioMedia = parsePersistedStudyMediaRecord(card.promptAudioMedia);
    if (promptAudioMedia) {
      collected.push(promptAudioMedia);
    }
    const answerAudioMedia = parsePersistedStudyMediaRecord(card.answerAudioMedia);
    if (answerAudioMedia) {
      collected.push(answerAudioMedia);
    }
    const imageMedia = parsePersistedStudyMediaRecord(card.imageMedia);
    if (imageMedia) {
      collected.push(imageMedia);
    }
    return collected;
  });

  const uniqueMedia = new Map<string, PersistedStudyMediaRecord>();
  for (const media of mediaRecords) {
    if (media.id && !uniqueMedia.has(media.id)) {
      uniqueMedia.set(media.id, media);
    }
  }

  await Promise.all(
    Array.from(uniqueMedia.values()).map(async (media) => {
      const updated = await backfillImportedStudyMedia(media);
      if (!updated) return;

      for (const card of cards) {
        if (isRecord(card.promptAudioMedia) && card.promptAudioMedia.id === media.id) {
          card.promptAudioMedia = mergeStudyMediaRecord(card.promptAudioMedia, updated);
        }
        if (isRecord(card.answerAudioMedia) && card.answerAudioMedia.id === media.id) {
          card.answerAudioMedia = mergeStudyMediaRecord(card.answerAudioMedia, updated);
        }
        if (isRecord(card.imageMedia) && card.imageMedia.id === media.id) {
          card.imageMedia = mergeStudyMediaRecord(card.imageMedia, updated);
        }
      }
    })
  );
}

export async function importJapaneseStudyColpkg(params: {
  userId: string;
  fileBuffer: Buffer;
  filename: string;
}): Promise<StudyImportResult> {
  const importJob = await prisma.studyImportJob.create({
    data: {
      userId: params.userId,
      status: 'processing',
      sourceFilename: sanitizeText(params.filename) ?? 'import.colpkg',
      deckName: ANKI_DECK_NAME,
      previewJson: toPrismaJson({
        deckName: ANKI_DECK_NAME,
        cardCount: 0,
        noteCount: 0,
        reviewLogCount: 0,
        mediaReferenceCount: 0,
        noteTypeBreakdown: [],
      }),
      startedAt: new Date(),
    },
  });

  try {
    const parsed = await parseColpkgUpload({
      fileBuffer: params.fileBuffer,
      filename: params.filename,
      userId: params.userId,
      importJobId: importJob.id,
    });

    await prisma.$transaction(async (tx) => {
      await tx.studyReviewLog.deleteMany({
        where: {
          userId: params.userId,
          source: 'anki_import',
        },
      });
      await tx.studyCard.deleteMany({
        where: {
          userId: params.userId,
          sourceKind: 'anki_import',
        },
      });
      await tx.studyNote.deleteMany({
        where: {
          userId: params.userId,
          sourceKind: 'anki_import',
        },
      });
      await tx.studyMedia.deleteMany({
        where: {
          userId: params.userId,
          sourceKind: 'anki_import',
        },
      });

      await tx.studyImportJob.update({
        where: { id: importJob.id },
        data: {
          previewJson: toPrismaJson(parsed.preview),
        },
      });

      await tx.studyNote.createMany({
        data: parsed.notes.map((note) => ({
          id: note.createId,
          userId: params.userId,
          importJobId: importJob.id,
          sourceKind: 'anki_import',
          sourceNoteId: BigInt(note.sourceNoteId),
          sourceGuid: sanitizeText(note.sourceGuid) ?? '',
          sourceDeckId: BigInt(note.sourceDeckId),
          sourceDeckName: ANKI_DECK_NAME,
          sourceNotetypeId: BigInt(note.sourceNotetypeId),
          sourceNotetypeName: sanitizeText(note.sourceNotetypeName) ?? '',
          rawFieldsJson: toPrismaJson(note.rawFields),
          canonicalJson: toPrismaJson(note.canonical),
        })),
      });

      await tx.studyMedia.createMany({
        data: parsed.media.map((media) => ({
          id: media.id,
          userId: params.userId,
          importJobId: importJob.id,
          sourceKind: 'anki_import',
          sourceMediaKey: sanitizeText(
            mediaByFilenameToSourceMediaKey(parsed.mediaByFilename, media.filename)
          ),
          sourceFilename: sanitizeText(media.filename) ?? '',
          normalizedFilename: normalizeFilename(media.filename),
          mediaKind: media.mediaKind,
          contentType: media.contentType,
          storagePath: media.storagePath,
          publicUrl: media.publicUrl,
        })),
      });

      await tx.studyCard.createMany({
        data: parsed.cards.map((card) => ({
          id: card.createId,
          userId: params.userId,
          noteId: card.noteCreateId,
          importJobId: importJob.id,
          sourceKind: 'anki_import',
          sourceCardId: BigInt(card.sourceCardId),
          sourceDeckId: BigInt(card.sourceDeckId),
          sourceDeckName: ANKI_DECK_NAME,
          sourceTemplateOrd: card.sourceTemplateOrd,
          sourceTemplateName: sanitizeText(card.sourceTemplateName),
          sourceQueue: card.sourceQueue,
          sourceCardType: card.sourceCardType,
          sourceDue: card.sourceDue,
          sourceInterval: card.sourceInterval,
          sourceFactor: card.sourceFactor,
          sourceReps: card.sourceReps,
          sourceLapses: card.sourceLapses,
          sourceLeft: card.sourceLeft,
          sourceOriginalDue: card.sourceOriginalDue,
          sourceOriginalDeckId: toBigIntOrNull(card.sourceOriginalDeckId),
          sourceFsrsJson: toNullablePrismaJson(card.sourceFsrs),
          cardType: card.cardType,
          queueState: card.queueState,
          dueAt: card.dueAt,
          lastReviewedAt: card.lastReviewedAt,
          promptJson: toPrismaJson(card.prompt),
          answerJson: toPrismaJson(card.answer),
          schedulerStateJson: toNullablePrismaJson(card.schedulerState),
          answerAudioSource: card.answerAudioSource,
          promptAudioMediaId: mediaByFilenameToRecordId(
            parsed.mediaByFilename,
            card.promptAudioMediaFilename
          ),
          answerAudioMediaId: mediaByFilenameToRecordId(
            parsed.mediaByFilename,
            card.answerAudioMediaFilename
          ),
          imageMediaId: mediaByFilenameToRecordId(parsed.mediaByFilename, card.imageMediaFilename),
        })),
      });

      const createdCardIdBySourceCardId = new Map(
        parsed.cards.map((card) => [card.sourceCardId, card.createId])
      );
      const reviewLogsToCreate = parsed.reviewLogs.flatMap((log) => {
        const cardId = createdCardIdBySourceCardId.get(log.sourceCardId);
        if (!cardId) {
          return [];
        }

        return [
          {
            id: log.createId,
            userId: params.userId,
            cardId,
            importJobId: importJob.id,
            source: 'anki_import' as const,
            sourceReviewId: BigInt(log.sourceReviewId),
            reviewedAt: log.reviewedAt,
            rating: log.rating,
            sourceEase: log.sourceEase,
            sourceInterval: log.sourceInterval,
            sourceLastInterval: log.sourceLastInterval,
            sourceFactor: log.sourceFactor,
            sourceTimeMs: log.sourceTimeMs,
            sourceReviewType: log.sourceReviewType,
            rawPayloadJson: toPrismaJson({
              reviewId: log.sourceReviewId,
              cardId: log.sourceCardId,
              ease: log.sourceEase,
              ivl: log.sourceInterval,
              lastIvl: log.sourceLastInterval,
              factor: log.sourceFactor,
              time: log.sourceTimeMs,
              type: log.sourceReviewType,
            }),
          },
        ];
      });
      await tx.studyReviewLog.createMany({
        data: reviewLogsToCreate,
      });

      await tx.studyImportJob.update({
        where: { id: importJob.id },
        data: {
          status: 'completed',
          previewJson: toPrismaJson(parsed.preview),
          summaryJson: toPrismaJson({
            cardCount: parsed.cards.length,
            noteCount: parsed.notes.length,
            reviewLogCount: parsed.reviewLogs.length,
            mediaCount: parsed.media.length,
          }),
          completedAt: new Date(),
        },
      });
    });

    return {
      id: importJob.id,
      status: 'completed',
      sourceFilename: sanitizeText(params.filename) ?? 'import.colpkg',
      deckName: ANKI_DECK_NAME,
      preview: parsed.preview,
      importedAt: new Date().toISOString(),
      errorMessage: null,
    };
  } catch (error) {
    const message = sanitizeText(error instanceof Error ? error.message : 'Study import failed.');
    await prisma.studyImportJob.update({
      where: { id: importJob.id },
      data: {
        status: 'failed',
        errorMessage: message ?? 'Study import failed.',
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

function mediaByFilenameToSourceMediaKey(
  mediaByFilename: Map<string, ParsedAnkiMediaRecord>,
  filename: string
): string | null {
  return mediaByFilename.get(filename)?.sourceMediaKey ?? null;
}

function mediaByFilenameToRecordId(
  mediaByFilename: Map<string, ParsedAnkiMediaRecord>,
  filename: string | null
): string | null {
  if (!filename) return null;
  return mediaByFilename.get(filename)?.id ?? null;
}

export async function getStudyImportJob(
  userId: string,
  importJobId: string
): Promise<StudyImportResult | null> {
  const job: StudyImportJobRecord | null = await prisma.studyImportJob.findFirst({
    where: {
      id: importJobId,
      userId,
    },
  });

  if (!job) return null;

  return {
    id: job.id,
    status: job.status as StudyImportResult['status'],
    sourceFilename: job.sourceFilename,
    deckName: job.deckName,
    preview: toStudyImportPreview(job.previewJson),
    importedAt: job.completedAt instanceof Date ? job.completedAt.toISOString() : null,
    errorMessage: typeof job.errorMessage === 'string' ? job.errorMessage : null,
  };
}

export async function getStudyOverview(userId: string): Promise<StudyOverview> {
  const now = new Date();
  const [
    dueCount,
    newCount,
    learningCount,
    reviewCount,
    suspendedCount,
    totalCards,
    nextDueCard,
    latestImport,
  ] = await Promise.all([
    prisma.studyCard.count({
      where: {
        userId,
        queueState: {
          in: ['learning', 'review', 'relearning'],
        },
        dueAt: {
          lte: now,
        },
      },
    }),
    prisma.studyCard.count({
      where: {
        userId,
        queueState: 'new',
      },
    }),
    prisma.studyCard.count({
      where: {
        userId,
        queueState: {
          in: ['learning', 'relearning'],
        },
      },
    }),
    prisma.studyCard.count({
      where: {
        userId,
        queueState: 'review',
      },
    }),
    prisma.studyCard.count({
      where: {
        userId,
        queueState: {
          in: ['suspended', 'buried'],
        },
      },
    }),
    prisma.studyCard.count({
      where: { userId },
    }),
    prisma.studyCard.findFirst({
      where: {
        userId,
        dueAt: {
          not: null,
        },
      },
      orderBy: {
        dueAt: 'asc',
      },
    }),
    prisma.studyImportJob.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }) as Promise<StudyImportJobRecord | null>,
  ]);

  return {
    dueCount,
    newCount,
    learningCount,
    reviewCount,
    suspendedCount,
    totalCards,
    latestImport: latestImport
      ? {
          id: latestImport.id,
          status: latestImport.status as StudyImportResult['status'],
          sourceFilename: latestImport.sourceFilename,
          deckName: latestImport.deckName,
          preview: toStudyImportPreview(latestImport.previewJson),
          importedAt:
            latestImport.completedAt instanceof Date
              ? latestImport.completedAt.toISOString()
              : null,
          errorMessage:
            typeof latestImport.errorMessage === 'string'
              ? String(latestImport.errorMessage)
              : null,
        }
      : null,
    nextDueAt: nextDueCard?.dueAt instanceof Date ? nextDueCard.dueAt.toISOString() : null,
  };
}

export async function startStudySession(userId: string, limit: number = DEFAULT_STUDY_LIMIT) {
  const now = new Date();
  const cards: StudyCardWithRelations[] = await prisma.studyCard.findMany({
    where: {
      userId,
      OR: [
        { queueState: 'new' },
        {
          queueState: {
            in: ['learning', 'review', 'relearning'],
          },
          dueAt: {
            lte: now,
          },
        },
      ],
    },
    include: {
      note: true,
      promptAudioMedia: true,
      answerAudioMedia: true,
      imageMedia: true,
    },
    orderBy: [{ dueAt: 'asc' }, { sourceDue: 'asc' }],
    take: limit,
  });

  await ensureStudyCardMediaAvailable(cards);

  return {
    overview: await getStudyOverview(userId),
    cards: await Promise.all(cards.map((card) => toStudyCardSummary(card))),
  };
}

export async function prepareStudyCardAnswerAudio(
  userId: string,
  cardId: string
): Promise<StudyCardSummary> {
  const existing: StudyCardWithRelations | null = await prisma.studyCard.findFirst({
    where: {
      id: cardId,
      userId,
    },
    include: {
      note: true,
      promptAudioMedia: true,
      answerAudioMedia: true,
      imageMedia: true,
    },
  });

  if (!existing) {
    throw new AppError('Study card not found.', 404);
  }

  await ensureGeneratedAnswerAudio(userId, cardId);

  const refreshed: StudyCardWithRelations | null = await prisma.studyCard.findFirst({
    where: {
      id: cardId,
      userId,
    },
    include: {
      note: true,
      promptAudioMedia: true,
      answerAudioMedia: true,
      imageMedia: true,
    },
  });

  if (!refreshed) {
    throw new AppError('Study card not found.', 404);
  }

  return await toStudyCardSummary(refreshed);
}

function toQueueStateFromFsrsState(state: number): StudyQueueState {
  return state === State.New
    ? 'new'
    : state === State.Learning
      ? 'learning'
      : state === State.Relearning
        ? 'relearning'
        : 'review';
}

function getRestoredQueueState(record: StudyCardWithRelations): StudyQueueState {
  const schedulerState = deserializeFsrsCard(
    (record.schedulerStateJson as StudyFsrsState | JsonRecord | null) ?? null
  );
  if (schedulerState) {
    return toQueueStateFromFsrsState(schedulerState.state);
  }

  const currentQueueState =
    typeof record.queueState === 'string' ? (record.queueState as StudyQueueState) : 'review';
  return currentQueueState === 'suspended' || currentQueueState === 'buried'
    ? 'review'
    : currentQueueState;
}

function getRestoredDueAt(
  record: StudyCardWithRelations,
  queueState: StudyQueueState
): Date | null {
  if (queueState === 'new') return null;

  const schedulerState = deserializeFsrsCard(
    (record.schedulerStateJson as StudyFsrsState | JsonRecord | null) ?? null
  );
  if (schedulerState) {
    return schedulerState.due;
  }

  return record.dueAt instanceof Date ? record.dueAt : new Date();
}

function resolveDueDate(mode: StudyCardSetDueMode, dueAt?: string): Date {
  if (mode === 'now') {
    return new Date();
  }

  if (mode === 'tomorrow') {
    return dateFromDayBoundary(1);
  }

  const customDueAt = dueAt ? new Date(dueAt) : null;
  if (!customDueAt || Number.isNaN(customDueAt.getTime())) {
    throw new AppError('A valid due date is required for custom_date.', 400);
  }

  return customDueAt;
}

function getSetDueSchedulerState(record: StudyCardWithRelations, dueAt: Date): StudyFsrsState {
  const existingScheduler = deserializeFsrsCard(
    (record.schedulerStateJson as StudyFsrsState | JsonRecord | null) ?? null
  );
  const now = new Date();

  if (existingScheduler && existingScheduler.state !== State.New) {
    return serializeFsrsCard({
      ...existingScheduler,
      due: dueAt,
      scheduled_days: getScheduledDaysForDue(dueAt, now),
    });
  }

  const freshReviewState = deserializeFsrsCard(createFreshSchedulerState(dueAt, State.Review));
  if (!freshReviewState) {
    throw new AppError('Unable to create scheduler state for due override.', 500);
  }

  return serializeFsrsCard({
    ...freshReviewState,
    due: dueAt,
    scheduled_days: getScheduledDaysForDue(dueAt, now),
  });
}

export async function recordStudyReview(params: {
  userId: string;
  cardId: string;
  grade: 'again' | 'hard' | 'good' | 'easy';
  durationMs?: number;
}): Promise<StudyReviewResult> {
  const gradeToRating: Record<typeof params.grade, Grade> = {
    again: Rating.Again,
    hard: Rating.Hard,
    good: Rating.Good,
    easy: Rating.Easy,
  };

  const card: StudyCardWithRelations | null = await prisma.studyCard.findFirst({
    where: {
      id: params.cardId,
      userId: params.userId,
    },
    include: {
      note: true,
      promptAudioMedia: true,
      answerAudioMedia: true,
      imageMedia: true,
    },
  });

  if (!card) {
    throw new AppError('Study card not found.', 404);
  }

  const previousState = deserializeFsrsCard(toStudyFsrsState(card.schedulerStateJson));
  if (!previousState) {
    throw new AppError('Study card is missing scheduler state.', 400);
  }

  const now = new Date();
  const nextState = scheduler.next(previousState, now, gradeToRating[params.grade]).card;
  const serializedNextState = serializeFsrsCard(nextState);
  const nextQueueState = toQueueStateFromFsrsState(nextState.state);
  const createdReviewLog = await prisma.$transaction(async (tx) => {
    await tx.studyCard.update({
      where: { id: params.cardId },
      data: {
        schedulerStateJson: toPrismaJson(serializedNextState),
        queueState: nextQueueState,
        dueAt: nextState.due,
        lastReviewedAt: now,
      },
    });

    return tx.studyReviewLog.create({
      data: {
        userId: params.userId,
        cardId: params.cardId,
        source: 'convolab',
        reviewedAt: now,
        rating: gradeToRating[params.grade],
        durationMs: params.durationMs ?? null,
        stateBeforeJson: toPrismaJson(serializeFsrsCard(previousState)),
        stateAfterJson: toPrismaJson(serializedNextState),
        rawPayloadJson: toPrismaJson({
          grade: params.grade,
          beforeQueueState: String(card.queueState),
          beforeDueAt: card.dueAt instanceof Date ? card.dueAt.toISOString() : null,
          beforeLastReviewedAt:
            card.lastReviewedAt instanceof Date ? card.lastReviewedAt.toISOString() : null,
        }),
      },
    });
  });

  const refreshed: StudyCardWithRelations | null = await prisma.studyCard.findFirst({
    where: {
      id: params.cardId,
      userId: params.userId,
    },
    include: {
      note: true,
      promptAudioMedia: true,
      answerAudioMedia: true,
      imageMedia: true,
    },
  });

  if (!refreshed) {
    throw new AppError('Study card not found after review.', 404);
  }

  return {
    reviewLogId: createdReviewLog.id,
    card: await toStudyCardSummary(refreshed),
    overview: await getStudyOverview(params.userId),
  };
}

export async function undoStudyReview(params: {
  userId: string;
  reviewLogId: string;
}): Promise<StudyUndoReviewResult> {
  const reviewLog = await prisma.studyReviewLog.findFirst({
    where: {
      id: params.reviewLogId,
      userId: params.userId,
      source: 'convolab',
    },
    include: {
      card: {
        include: {
          note: true,
        },
      },
    },
  });

  if (!reviewLog) {
    throw new AppError('Undo target not found.', 404);
  }

  const cardRecord = reviewLog.card;
  if (!cardRecord) {
    throw new AppError('Study card not found for undo.', 404);
  }

  const newerReview = await prisma.studyReviewLog.findFirst({
    where: {
      userId: params.userId,
      cardId: String(reviewLog.cardId),
      source: 'convolab',
      reviewedAt: {
        gt: reviewLog.reviewedAt as Date,
      },
    },
  });

  if (newerReview) {
    throw new AppError('Only the latest review for this card can be undone.', 409);
  }

  const previousState = deserializeFsrsCard(toStudyFsrsState(reviewLog.stateBeforeJson));
  if (!previousState) {
    throw new AppError('Undo state is missing for this review.', 400);
  }

  const rawPayload = isRecord(reviewLog.rawPayloadJson) ? reviewLog.rawPayloadJson : {};
  const restoredQueueState =
    typeof rawPayload.beforeQueueState === 'string'
      ? (rawPayload.beforeQueueState as StudyQueueState)
      : toQueueStateFromFsrsState(previousState.state);
  const restoredDueAt =
    typeof rawPayload.beforeDueAt === 'string'
      ? new Date(rawPayload.beforeDueAt)
      : restoredQueueState === 'new'
        ? null
        : previousState.due;
  const restoredLastReviewedAt =
    typeof rawPayload.beforeLastReviewedAt === 'string'
      ? new Date(rawPayload.beforeLastReviewedAt)
      : (previousState.last_review ?? null);

  await prisma.$transaction(async (tx) => {
    await tx.studyCard.update({
      where: { id: String(reviewLog.cardId) },
      data: {
        schedulerStateJson: toPrismaJson(serializeFsrsCard(previousState)),
        queueState: restoredQueueState,
        dueAt: restoredDueAt,
        lastReviewedAt: restoredLastReviewedAt,
      },
    });

    await tx.studyReviewLog.delete({
      where: { id: params.reviewLogId },
    });
  });

  const refreshed = (await prisma.studyCard.findFirst({
    where: {
      id: reviewLog.cardId,
      userId: params.userId,
    },
    include: {
      note: true,
      promptAudioMedia: true,
      answerAudioMedia: true,
      imageMedia: true,
    },
  })) as StudyCardWithRelations | null;

  if (!refreshed) {
    throw new AppError('Study card not found after undo.', 404);
  }

  return {
    reviewLogId: params.reviewLogId,
    card: await toStudyCardSummary(refreshed),
    overview: await getStudyOverview(params.userId),
  };
}

export async function performStudyCardAction(
  input: PerformStudyCardActionInput
): Promise<StudyCardActionResult> {
  const existing: StudyCardWithRelations | null = await prisma.studyCard.findFirst({
    where: {
      id: input.cardId,
      userId: input.userId,
    },
    include: {
      note: true,
      promptAudioMedia: true,
      answerAudioMedia: true,
      imageMedia: true,
    },
  });

  if (!existing) {
    throw new AppError('Study card not found.', 404);
  }

  let nextQueueState =
    typeof existing.queueState === 'string'
      ? (existing.queueState as StudyQueueState)
      : ('review' as StudyQueueState);
  let nextDueAt = existing.dueAt instanceof Date ? existing.dueAt : null;
  let nextSchedulerState = toStudyFsrsState(existing.schedulerStateJson);
  let nextLastReviewedAt = existing.lastReviewedAt instanceof Date ? existing.lastReviewedAt : null;

  if (input.action === 'suspend') {
    nextQueueState = 'suspended';
  } else if (input.action === 'unsuspend') {
    nextQueueState = getRestoredQueueState(existing);
    nextDueAt = getRestoredDueAt(existing, nextQueueState);
  } else if (input.action === 'forget') {
    nextQueueState = 'new';
    nextDueAt = null;
    nextSchedulerState = createFreshSchedulerState();
    nextLastReviewedAt = null;
  } else if (input.action === 'set_due') {
    const mode = input.mode;
    if (!mode) {
      throw new AppError('A due mode is required for set_due.', 400);
    }

    const resolvedDueAt = resolveDueDate(mode, input.dueAt);
    nextQueueState = getRestoredQueueState(existing);
    nextQueueState = nextQueueState === 'new' ? 'review' : nextQueueState;
    nextDueAt = resolvedDueAt;
    nextSchedulerState = getSetDueSchedulerState(existing, resolvedDueAt);
  }

  await prisma.studyCard.update({
    where: { id: input.cardId },
    data: {
      queueState: nextQueueState,
      dueAt: nextDueAt,
      schedulerStateJson: toNullablePrismaJson(nextSchedulerState),
      lastReviewedAt: nextLastReviewedAt,
    },
  });

  const refreshed: StudyCardWithRelations | null = await prisma.studyCard.findFirst({
    where: {
      id: input.cardId,
      userId: input.userId,
    },
    include: {
      note: true,
      promptAudioMedia: true,
      answerAudioMedia: true,
      imageMedia: true,
    },
  });

  if (!refreshed) {
    throw new AppError('Study card not found after update.', 404);
  }

  return {
    card: await toStudyCardSummary(refreshed),
    overview: await getStudyOverview(input.userId),
  };
}

export async function updateStudyCard(input: UpdateStudyCardInput): Promise<StudyCardSummary> {
  const existing: StudyCardWithRelations | null = await prisma.studyCard.findFirst({
    where: {
      id: input.cardId,
      userId: input.userId,
    },
    include: {
      note: true,
      promptAudioMedia: true,
      answerAudioMedia: true,
      imageMedia: true,
    },
  });

  if (!existing) {
    throw new AppError('Study card not found.', 404);
  }

  const currentNormalized = await normalizeStudyCardPayload(existing);
  const mergedPrompt: StudyPromptPayload = {
    ...currentNormalized.prompt,
    ...input.prompt,
  };
  const mergedAnswer: StudyAnswerPayload = {
    ...currentNormalized.answer,
    ...input.answer,
  };

  const normalizedPayload =
    existing.cardType === 'cloze'
      ? await normalizeClozePayload({
          activeOrdinal:
            typeof existing.sourceTemplateOrd === 'number' ? existing.sourceTemplateOrd : 0,
          prompt: mergedPrompt,
          answer: mergedAnswer,
        })
      : {
          prompt: mergedPrompt,
          answer: mergedAnswer,
        };

  const previousAudioText = getBestAnswerAudioText(currentNormalized.answer);
  const nextAudioText = getBestAnswerAudioText(normalizedPayload.answer);
  const shouldRegenerateAnswerAudio = previousAudioText !== nextAudioText;

  const nextAnswer: StudyAnswerPayload = shouldRegenerateAnswerAudio
    ? {
        ...normalizedPayload.answer,
        answerAudio: null,
      }
    : normalizedPayload.answer;

  await prisma.studyCard.update({
    where: { id: input.cardId },
    data: {
      promptJson: toPrismaJson(normalizedPayload.prompt),
      answerJson: toPrismaJson(nextAnswer),
      answerAudioSource: shouldRegenerateAnswerAudio ? 'missing' : existing.answerAudioSource,
      answerAudioMediaId: shouldRegenerateAnswerAudio ? null : existing.answerAudioMediaId,
    },
  });

  if (shouldRegenerateAnswerAudio) {
    await ensureGeneratedAnswerAudio(input.userId, input.cardId);
  }

  const refreshed: StudyCardWithRelations | null = await prisma.studyCard.findFirst({
    where: {
      id: input.cardId,
      userId: input.userId,
    },
    include: {
      note: true,
      promptAudioMedia: true,
      answerAudioMedia: true,
      imageMedia: true,
    },
  });

  if (!refreshed) {
    throw new AppError('Study card not found after update.', 404);
  }

  return await toStudyCardSummary(refreshed);
}

export async function createStudyCard(input: CreateStudyCardInput): Promise<StudyCardSummary> {
  const normalizedPayload =
    input.cardType === 'cloze'
      ? await normalizeClozePayload({
          activeOrdinal: 0,
          prompt: input.prompt,
          answer: input.answer,
        })
      : { prompt: input.prompt, answer: input.answer };

  const note = await prisma.studyNote.create({
    data: {
      userId: input.userId,
      sourceKind: 'convolab',
      rawFieldsJson: toPrismaJson({}),
      canonicalJson: toPrismaJson({
        createdInApp: true,
      }),
    },
  });

  const initialState = createFreshSchedulerState();

  const created: StudyCardWithRelations = await prisma.studyCard.create({
    data: {
      userId: input.userId,
      noteId: note.id,
      sourceKind: 'convolab',
      cardType: input.cardType,
      queueState: 'new',
      promptJson: toPrismaJson(normalizedPayload.prompt),
      answerJson: toPrismaJson(normalizedPayload.answer),
      schedulerStateJson: toPrismaJson(initialState),
      answerAudioSource: 'missing',
    },
    include: {
      note: true,
      promptAudioMedia: true,
      answerAudioMedia: true,
      imageMedia: true,
    },
  });

  await ensureGeneratedAnswerAudio(input.userId, created.id);

  const refreshed: StudyCardWithRelations | null = await prisma.studyCard.findFirst({
    where: {
      id: created.id,
      userId: input.userId,
    },
    include: {
      note: true,
      promptAudioMedia: true,
      answerAudioMedia: true,
      imageMedia: true,
    },
  });

  if (!refreshed) {
    throw new AppError('Study card not found after creation.', 404);
  }

  return await toStudyCardSummary(refreshed);
}

export async function getStudyHistory(
  userId: string,
  cardId?: string
): Promise<StudyReviewEvent[]> {
  const logs: StudyReviewLogRecord[] = await prisma.studyReviewLog.findMany({
    where: {
      userId,
      ...(cardId ? { cardId } : {}),
    },
    orderBy: {
      reviewedAt: 'desc',
    },
    take: 200,
  });

  return logs.map((log) => ({
    id: log.id,
    cardId: log.cardId,
    source: log.source as StudyReviewEvent['source'],
    reviewedAt: log.reviewedAt.toISOString(),
    rating: log.rating,
    durationMs: typeof log.durationMs === 'number' ? log.durationMs : null,
    sourceReviewId: typeof log.sourceReviewId === 'bigint' ? String(log.sourceReviewId) : null,
    stateBefore: toStudyFsrsState(log.stateBeforeJson),
    stateAfter: toStudyFsrsState(log.stateAfterJson),
    rawPayload: isRecord(log.rawPayloadJson) ? log.rawPayloadJson : null,
  }));
}

function escapeLikePattern(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}

function buildStudyBrowserWhereSql(params: {
  userId: string;
  q?: string;
  noteType?: string;
  cardType?: StudyCardType;
  queueState?: StudyQueueState;
}) {
  const clauses: Prisma.Sql[] = [Prisma.sql`n."userId" = ${params.userId}`];

  if (params.noteType) {
    clauses.push(Prisma.sql`n."sourceNotetypeName" = ${params.noteType}`);
  }

  if (params.cardType) {
    clauses.push(
      Prisma.sql`EXISTS (
        SELECT 1
        FROM "study_cards" sc_filter
        WHERE sc_filter."noteId" = n.id
          AND sc_filter."userId" = ${params.userId}
          AND sc_filter."cardType" = ${params.cardType}
      )`
    );
  }

  if (params.queueState) {
    clauses.push(
      Prisma.sql`EXISTS (
        SELECT 1
        FROM "study_cards" sq_filter
        WHERE sq_filter."noteId" = n.id
          AND sq_filter."userId" = ${params.userId}
          AND sq_filter."queueState" = ${params.queueState}
      )`
    );
  }

  const searchNeedle = sanitizeText(params.q)?.trim().toLowerCase() ?? '';
  if (searchNeedle) {
    const searchPattern = `%${escapeLikePattern(searchNeedle)}%`;
    clauses.push(
      Prisma.sql`(
        COALESCE(CAST(n."rawFieldsJson" AS TEXT), '') ILIKE ${searchPattern} ESCAPE '\'
        OR COALESCE(CAST(n."canonicalJson" AS TEXT), '') ILIKE ${searchPattern} ESCAPE '\'
        OR EXISTS (
          SELECT 1
          FROM "study_cards" sc_search
          WHERE sc_search."noteId" = n.id
            AND sc_search."userId" = ${params.userId}
            AND (
              COALESCE(CAST(sc_search."promptJson" AS TEXT), '') ILIKE ${searchPattern} ESCAPE '\'
              OR COALESCE(CAST(sc_search."answerJson" AS TEXT), '') ILIKE ${searchPattern} ESCAPE '\'
            )
        )
      )`
    );
  }

  return Prisma.sql`WHERE ${Prisma.join(clauses, ' AND ')}`;
}

function buildStudyCardOptionLabel(card: StudyCardOptionRecord): string {
  const prompt = isRecord(card.promptJson) ? card.promptJson : {};
  const answer = isRecord(card.answerJson) ? card.answerJson : {};
  const label =
    noteFieldValueToString(answer.expression) ??
    noteFieldValueToString(answer.restoredText) ??
    noteFieldValueToString(prompt.cueText) ??
    noteFieldValueToString(prompt.clozeDisplayText) ??
    noteFieldValueToString(answer.meaning) ??
    String(card.id);

  return stripHtml(label) ?? label;
}

export async function getStudyCardOptions(
  userId: string,
  limit: number
): Promise<StudyCardOptionsResponse> {
  const [total, cards] = await Promise.all([
    prisma.studyCard.count({
      where: { userId },
    }),
    prisma.studyCard.findMany({
      where: { userId },
      select: {
        id: true,
        promptJson: true,
        answerJson: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    }) as Promise<StudyCardOptionRecord[]>,
  ]);

  return {
    total,
    options: cards.map<StudyCardOption>((card) => ({
      id: card.id,
      label: buildStudyCardOptionLabel(card),
    })),
  };
}

export async function getStudyBrowserList(params: {
  userId: string;
  q?: string;
  noteType?: string;
  cardType?: StudyCardType;
  queueState?: StudyQueueState;
  page?: number;
  pageSize?: number;
}): Promise<StudyBrowserListResponse> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, params.pageSize ?? 100));
  const offset = (page - 1) * pageSize;
  const whereSql = buildStudyBrowserWhereSql(params);

  const [totalRows, noteIdRows, reviewCounts, noteTypeRows, cardTypeRows, queueStateRows] =
    await Promise.all([
      prisma.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
      SELECT COUNT(*) AS count
      FROM "study_notes" n
      ${whereSql}
    `),
      prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT n.id
      FROM "study_notes" n
      ${whereSql}
      ORDER BY n."updatedAt" DESC
      OFFSET ${offset}
      LIMIT ${pageSize}
    `),
      prisma.studyReviewLog.groupBy({
        by: ['cardId'],
        where: { userId: params.userId },
        _count: { _all: true },
      }),
      prisma.$queryRaw<Array<{ value: string | null }>>(Prisma.sql`
      SELECT DISTINCT n."sourceNotetypeName" AS value
      FROM "study_notes" n
      ${whereSql}
      ORDER BY value ASC
    `),
      prisma.$queryRaw<Array<{ value: string | null }>>(Prisma.sql`
      SELECT DISTINCT c."cardType" AS value
      FROM "study_cards" c
      JOIN "study_notes" n ON n.id = c."noteId"
      ${whereSql}
      AND c."userId" = ${params.userId}
      ORDER BY value ASC
    `),
      prisma.$queryRaw<Array<{ value: string | null }>>(Prisma.sql`
      SELECT DISTINCT c."queueState" AS value
      FROM "study_cards" c
      JOIN "study_notes" n ON n.id = c."noteId"
      ${whereSql}
      AND c."userId" = ${params.userId}
      ORDER BY value ASC
    `),
    ]);

  const noteIds = noteIdRows.map((row) => row.id);
  const notes: StudyBrowserListNoteRecord[] =
    noteIds.length > 0
      ? await prisma.studyNote.findMany({
          where: {
            userId: params.userId,
            id: {
              in: noteIds,
            },
          },
          include: {
            cards: {
              select: {
                id: true,
                cardType: true,
                queueState: true,
                promptJson: true,
                answerJson: true,
                updatedAt: true,
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
        })
      : [];

  const reviewCountsByCard = new Map<string, number>(
    reviewCounts.map((row) => [String(row.cardId), row._count._all])
  );
  const filterOptions: StudyBrowserFilterOptions = {
    noteTypes: noteTypeRows
      .map((row) => row.value)
      .filter((value): value is string => Boolean(value)),
    cardTypes: cardTypeRows
      .map((row) => row.value)
      .filter(
        (value): value is StudyCardType =>
          value === 'recognition' || value === 'production' || value === 'cloze'
      ),
    queueStates: queueStateRows
      .map((row) => row.value)
      .filter(
        (value): value is StudyQueueState =>
          value === 'new' ||
          value === 'learning' ||
          value === 'review' ||
          value === 'relearning' ||
          value === 'suspended' ||
          value === 'buried'
      ),
  };
  const totalValue = totalRows[0]?.count ?? 0;
  const total = typeof totalValue === 'bigint' ? Number(totalValue) : Number(totalValue);

  const rows: StudyBrowserRow[] = notes.map((note) => {
    const cards: StudyBrowserListCardRecord[] = note.cards;
    const queueSummary = cards.reduce<Partial<Record<StudyQueueState, number>>>((acc, card) => {
      const state = card.queueState as StudyQueueState;
      if (state) {
        acc[state] = (acc[state] ?? 0) + 1;
      }
      return acc;
    }, {});
    const reviewCount = cards.reduce((totalForNote, card) => {
      return totalForNote + (reviewCountsByCard.get(String(card.id)) ?? 0);
    }, 0);

    return {
      noteId: note.id,
      displayText: getNoteDisplayText(note, cards),
      noteTypeName: typeof note.sourceNotetypeName === 'string' ? note.sourceNotetypeName : null,
      cardCount: cards.length,
      reviewCount,
      queueSummary,
      updatedAt: note.updatedAt.toISOString(),
    };
  });

  return {
    rows,
    total,
    page,
    pageSize,
    filterOptions,
  };
}

export async function getStudyBrowserNoteDetail(
  userId: string,
  noteId: string
): Promise<StudyBrowserNoteDetail | null> {
  const note: StudyBrowserDetailNoteRecord | null = await prisma.studyNote.findFirst({
    where: {
      id: noteId,
      userId,
    },
    include: {
      cards: {
        include: {
          note: true,
          promptAudioMedia: true,
          answerAudioMedia: true,
          imageMedia: true,
        },
        orderBy: [{ sourceTemplateOrd: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });

  if (!note) {
    return null;
  }

  const cards = note.cards;
  await ensureStudyCardMediaAvailable(cards);
  const cardSummaries = await Promise.all(cards.map((card) => toStudyCardSummary(card)));

  const reviewCounts =
    cards.length > 0
      ? await prisma.studyReviewLog.groupBy({
          by: ['cardId'],
          where: {
            userId,
            cardId: {
              in: cards.map((card) => card.id),
            },
          },
          _count: { _all: true },
          _max: { reviewedAt: true },
        })
      : [];

  const cardStats: StudyBrowserCardStats[] = reviewCounts.map((row) => ({
    cardId: String(row.cardId),
    reviewCount: row._count._all,
    lastReviewedAt: row._max.reviewedAt instanceof Date ? row._max.reviewedAt.toISOString() : null,
  }));

  const statsByCardId = new Map(cardStats.map((entry) => [entry.cardId, entry]));
  for (const card of cardSummaries) {
    if (!statsByCardId.has(card.id)) {
      cardStats.push({
        cardId: card.id,
        reviewCount: 0,
        lastReviewedAt: null,
      });
    }
  }

  const mediaLookup = buildMediaLookup(cardSummaries);
  const rawFieldsRecord = isRecord(note.rawFieldsJson) ? note.rawFieldsJson : {};
  const canonicalFieldsRecord = isRecord(note.canonicalJson) ? note.canonicalJson : {};

  return {
    noteId: note.id,
    displayText: getNoteDisplayText(note, cards),
    noteTypeName: typeof note.sourceNotetypeName === 'string' ? note.sourceNotetypeName : null,
    sourceKind: typeof note.sourceKind === 'string' ? note.sourceKind : 'anki_import',
    updatedAt: note.updatedAt.toISOString(),
    rawFields: Object.entries(rawFieldsRecord).map(([name, value]) =>
      toStudyBrowserField(name, value, mediaLookup)
    ),
    canonicalFields: Object.entries(canonicalFieldsRecord).map(([name, value]) =>
      toStudyBrowserField(name, value, mediaLookup)
    ),
    cards: cardSummaries,
    cardStats,
    selectedCardId: cardSummaries[0]?.id ?? null,
  };
}

export async function exportStudyData(userId: string): Promise<StudyExportManifest> {
  const [cards, reviewLogs, media, imports] = await Promise.all([
    prisma.studyCard.findMany({
      where: { userId },
      include: { note: true, promptAudioMedia: true, answerAudioMedia: true, imageMedia: true },
      orderBy: { createdAt: 'asc' },
    }) as Promise<StudyCardWithRelations[]>,
    prisma.studyReviewLog.findMany({
      where: { userId },
      orderBy: { reviewedAt: 'asc' },
    }) as Promise<StudyReviewLogRecord[]>,
    prisma.studyMedia.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    }) as Promise<StudyMediaRecord[]>,
    prisma.studyImportJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    }) as Promise<StudyImportJobRecord[]>,
  ]);

  return {
    exportedAt: new Date().toISOString(),
    cards: await Promise.all(cards.map((card) => toStudyCardSummary(card))),
    reviewLogs: reviewLogs.map((log) => ({
      id: log.id,
      cardId: log.cardId,
      source: log.source as StudyReviewEvent['source'],
      reviewedAt: log.reviewedAt.toISOString(),
      rating: log.rating,
      durationMs: typeof log.durationMs === 'number' ? log.durationMs : null,
      sourceReviewId: typeof log.sourceReviewId === 'bigint' ? String(log.sourceReviewId) : null,
      stateBefore: toStudyFsrsState(log.stateBeforeJson),
      stateAfter: toStudyFsrsState(log.stateAfterJson),
      rawPayload: isRecord(log.rawPayloadJson) ? log.rawPayloadJson : null,
    })),
    media: media.map((item) => ({
      id: item.id,
      filename: item.sourceFilename,
      url: typeof item.publicUrl === 'string' ? item.publicUrl : null,
      mediaKind: item.mediaKind as StudyMediaRef['mediaKind'],
      source:
        item.sourceKind === 'generated'
          ? 'generated'
          : item.mediaKind === 'image'
            ? 'imported_image'
            : item.mediaKind === 'audio'
              ? 'imported'
              : 'imported_other',
    })),
    imports: imports.map((item) => ({
      id: item.id,
      status: item.status as StudyImportResult['status'],
      sourceFilename: item.sourceFilename,
      deckName: item.deckName,
      preview: toStudyImportPreview(item.previewJson),
      importedAt: item.completedAt instanceof Date ? item.completedAt.toISOString() : null,
      errorMessage: typeof item.errorMessage === 'string' ? item.errorMessage : null,
    })),
  };
}
