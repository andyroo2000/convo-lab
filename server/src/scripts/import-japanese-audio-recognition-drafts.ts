#!/usr/bin/env tsx
/* eslint-disable no-console */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  StudyCardCreationKind,
  StudyCardImagePlacement,
  StudyCardType,
  StudyManualCardDraft,
} from '@languageflow/shared/src/types.js';

const DEFAULT_BASE_URL = 'https://convo-lab.com';
const DEFAULT_DELAY_MS = 1000;
const DEFAULT_POLL_INTERVAL_MS = 5000;
const DEFAULT_POLL_TIMEOUT_MS = 120000;
const XSRF_COOKIE_NAME = 'XSRF-TOKEN';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type JapaneseAudioRecognitionManifestRow = {
  sourceImage?: string;
  source?: string;
  image?: string;
  sentence?: string;
  japanese?: string;
  japaneseSentence?: string;
  text?: string;
  expressionReading?: string;
  notes?: string;
  status?: string;
  queuedDraftId?: string | null;
  queuedAt?: string | null;
  error?: string | null;
  lastApiStatus?: number | null;
  [key: string]: unknown;
};

export type ManifestEntry = {
  lineNumber: number;
  row: JapaneseAudioRecognitionManifestRow;
  sentence: string;
  expressionReading: string | null;
  sourceImage: string | null;
};

export type PlannedManifestEntry = ManifestEntry & {
  action: 'queue' | 'skip';
  reason: 'ready_to_queue' | 'already_queued' | 'duplicate_sentence';
};

export type QueueDraftResult = {
  draft: StudyManualCardDraft;
  httpStatus: number;
};

export type ImportSummary = {
  totalRows: number;
  toQueue: number;
  queued: number;
  alreadyQueued: number;
  duplicates: number;
  failed: number;
  dryRun: boolean;
};

type CliOptions = {
  manifestPath: string;
  baseUrl: string;
  apply: boolean;
  delayMs: number;
  poll: boolean;
  pollIntervalMs: number;
  pollTimeoutMs: number;
};

function getStringField(
  row: JapaneseAudioRecognitionManifestRow,
  keys: Array<keyof JapaneseAudioRecognitionManifestRow>
): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function getManifestSentence(row: JapaneseAudioRecognitionManifestRow): string | null {
  return getStringField(row, ['sentence', 'japaneseSentence', 'japanese', 'text']);
}

function getManifestSource(row: JapaneseAudioRecognitionManifestRow): string | null {
  return getStringField(row, ['sourceImage', 'source', 'image']);
}

function getManifestExpressionReading(row: JapaneseAudioRecognitionManifestRow): string | null {
  return getStringField(row, ['expressionReading']);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function readManifest(manifestPath: string): Promise<ManifestEntry[]> {
  const contents = await readFile(manifestPath, 'utf8');
  const entries: ManifestEntry[] = [];

  contents.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Manifest line ${String(index + 1)} is not valid JSON: ${message}`);
    }

    if (!isRecord(parsed)) {
      throw new Error(`Manifest line ${String(index + 1)} must be a JSON object.`);
    }

    const row = parsed as JapaneseAudioRecognitionManifestRow;
    const sentence = getManifestSentence(row);
    if (!sentence) {
      throw new Error(
        `Manifest line ${String(index + 1)} must include sentence, japaneseSentence, japanese, or text.`
      );
    }

    entries.push({
      lineNumber: index + 1,
      row,
      sentence,
      expressionReading: getManifestExpressionReading(row),
      sourceImage: getManifestSource(row),
    });
  });

  return entries;
}

export function serializeManifest(entries: ManifestEntry[]): string {
  return `${entries.map((entry) => JSON.stringify(entry.row)).join('\n')}\n`;
}

export async function writeManifest(manifestPath: string, entries: ManifestEntry[]): Promise<void> {
  await writeFile(manifestPath, serializeManifest(entries), 'utf8');
}

export function planManifestImport(entries: ManifestEntry[]): PlannedManifestEntry[] {
  const seenSentences = new Set<string>();

  return entries.map((entry) => {
    const queuedDraftId =
      typeof entry.row.queuedDraftId === 'string' && entry.row.queuedDraftId.trim().length > 0
        ? entry.row.queuedDraftId.trim()
        : null;

    if (queuedDraftId) {
      seenSentences.add(entry.sentence);
      return {
        ...entry,
        action: 'skip',
        reason: 'already_queued',
      };
    }

    if (seenSentences.has(entry.sentence)) {
      return {
        ...entry,
        action: 'skip',
        reason: 'duplicate_sentence',
      };
    }

    seenSentences.add(entry.sentence);
    return {
      ...entry,
      action: 'queue',
      reason: 'ready_to_queue',
    };
  });
}

function parseCookieHeader(cookieHeader: string): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const segment of cookieHeader.split(';')) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex <= 0) continue;
    cookies.set(trimmed.slice(0, equalsIndex), trimmed.slice(equalsIndex + 1));
  }

  return cookies;
}

function getSetCookieHeaders(headers: Headers): string[] {
  const headersWithSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };
  if (typeof headersWithSetCookie.getSetCookie === 'function') {
    const setCookies = headersWithSetCookie.getSetCookie();
    if (setCookies.length > 0) return setCookies;
  }

  const combined = headers.get('set-cookie');
  return combined ? [combined] : [];
}

function mergeSetCookies(cookieHeader: string, setCookieHeaders: string[]): string {
  const cookies = parseCookieHeader(cookieHeader);

  for (const setCookie of setCookieHeaders) {
    const firstSegment = setCookie.split(';')[0]?.trim();
    if (!firstSegment) continue;
    const equalsIndex = firstSegment.indexOf('=');
    if (equalsIndex <= 0) continue;
    cookies.set(firstSegment.slice(0, equalsIndex), firstSegment.slice(equalsIndex + 1));
  }

  return [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

function getCookieValue(cookieHeader: string, name: string): string | null {
  const value = parseCookieHeader(cookieHeader).get(name);
  if (!value) return null;

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function formatApiErrorStatus(status: number, payload: unknown): string {
  if (isRecord(payload)) {
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message.trim();
    }
    const error = payload.error;
    if (isRecord(error) && typeof error.message === 'string' && error.message.trim()) {
      return error.message.trim();
    }
  }

  return `Request failed with HTTP ${String(status)}.`;
}

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

export class ConvoLabDraftApiClient {
  private cookieHeader: string;

  private csrfToken: string | null = null;

  private readonly baseUrl: string;

  private readonly origin: string;

  private readonly fetchFn: FetchLike;

  constructor(input: { baseUrl?: string; cookieHeader: string; fetchFn?: FetchLike }) {
    if (!input.cookieHeader.trim()) {
      throw new Error('CONVOLAB_PROD_COOKIE is required when --apply is used.');
    }

    this.baseUrl = (input.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.origin = new URL(this.baseUrl).origin;
    this.cookieHeader = input.cookieHeader.trim();
    this.fetchFn = input.fetchFn ?? fetch;
  }

  async bootstrapCsrf(): Promise<string> {
    const response = await this.fetchFn(new URL('/api/auth/csrf', this.baseUrl), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Cookie: this.cookieHeader,
        Origin: this.origin,
      },
    });

    this.cookieHeader = mergeSetCookies(this.cookieHeader, getSetCookieHeaders(response.headers));
    if (!response.ok) {
      throw new ApiRequestError('Could not bootstrap CSRF token.', response.status);
    }

    const token = getCookieValue(this.cookieHeader, XSRF_COOKIE_NAME);
    if (!token) {
      throw new Error('CSRF response did not include an XSRF-TOKEN cookie.');
    }

    this.csrfToken = token;
    return token;
  }

  async queueAudioRecognitionDraft(
    sentence: string,
    expressionReading?: string | null
  ): Promise<QueueDraftResult> {
    if (!this.csrfToken) {
      await this.bootstrapCsrf();
    }

    const body = {
      creationKind: 'audio-recognition' satisfies StudyCardCreationKind,
      cardType: 'recognition' satisfies StudyCardType,
      prompt: {},
      answer: {
        expression: sentence,
        ...(expressionReading ? { expressionReading } : {}),
      },
      imagePlacement: 'none' satisfies StudyCardImagePlacement,
      imagePrompt: null,
    };

    const response = await this.fetchFn(new URL('/api/study/card-drafts', this.baseUrl), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Cookie: this.cookieHeader,
        [CSRF_HEADER_NAME]: this.csrfToken ?? '',
        Origin: this.origin,
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ApiRequestError(formatApiErrorStatus(response.status, payload), response.status);
    }

    return {
      draft: payload as StudyManualCardDraft,
      httpStatus: response.status,
    };
  }

  async listDrafts(): Promise<StudyManualCardDraft[]> {
    const drafts: StudyManualCardDraft[] = [];
    let cursor: string | null = null;

    do {
      const url = new URL('/api/study/card-drafts?limit=2000', this.baseUrl);
      if (cursor) {
        url.searchParams.set('cursor', cursor);
      }
      const response = await this.fetchFn(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Cookie: this.cookieHeader,
          Origin: this.origin,
        },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new ApiRequestError(formatApiErrorStatus(response.status, payload), response.status);
      }
      if (!isRecord(payload) || !Array.isArray(payload.drafts)) {
        throw new Error('Draft list response did not include drafts.');
      }

      drafts.push(...(payload.drafts as StudyManualCardDraft[]));
      cursor =
        typeof payload.nextCursor === 'string' && payload.nextCursor ? payload.nextCursor : null;
    } while (cursor);

    return drafts;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildSummary(
  planned: PlannedManifestEntry[],
  queued: number,
  failed: number,
  dryRun: boolean
): ImportSummary {
  return {
    totalRows: planned.length,
    toQueue: planned.filter((entry) => entry.reason === 'ready_to_queue').length,
    queued,
    alreadyQueued: planned.filter((entry) => entry.reason === 'already_queued').length,
    duplicates: planned.filter((entry) => entry.reason === 'duplicate_sentence').length,
    failed,
    dryRun,
  };
}

function applyDuplicateStatuses(planned: PlannedManifestEntry[]): void {
  for (const entry of planned) {
    if (entry.reason !== 'duplicate_sentence') continue;
    entry.row.status = 'duplicate';
    entry.row.error = null;
    entry.row.lastApiStatus = null;
  }
}

export async function importManifestDrafts(input: {
  manifestPath: string;
  apply: boolean;
  client?: Pick<ConvoLabDraftApiClient, 'queueAudioRecognitionDraft'>;
  delayMs?: number;
  now?: () => Date;
}): Promise<ImportSummary> {
  const entries = await readManifest(input.manifestPath);
  const planned = planManifestImport(entries);
  const queueable = planned.filter((entry) => entry.reason === 'ready_to_queue');

  if (!input.apply) {
    return buildSummary(planned, 0, 0, true);
  }

  if (!input.client) {
    throw new Error('An API client is required when apply is true.');
  }

  applyDuplicateStatuses(planned);
  await writeManifest(input.manifestPath, entries);

  let queued = 0;
  let failed = 0;
  const now = input.now ?? (() => new Date());
  const delayMs = input.delayMs ?? DEFAULT_DELAY_MS;

  for (let index = 0; index < queueable.length; index += 1) {
    const entry = queueable[index];
    if (!entry) continue;

    try {
      const result = await input.client.queueAudioRecognitionDraft(
        entry.sentence,
        entry.expressionReading
      );
      entry.row.status = 'queued';
      entry.row.queuedDraftId = result.draft.id;
      entry.row.queuedAt = now().toISOString();
      entry.row.error = null;
      entry.row.lastApiStatus = result.httpStatus;
      queued += 1;
    } catch (error) {
      entry.row.status = 'error';
      entry.row.error = error instanceof Error ? error.message : String(error);
      entry.row.lastApiStatus = error instanceof ApiRequestError ? error.status : null;
      failed += 1;
    }

    await writeManifest(input.manifestPath, entries);
    if (index < queueable.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return buildSummary(planned, queued, failed, false);
}

function parseNumberOption(args: string[], name: string, fallback: number): number {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const raw = args[index + 1];
  const parsed = raw ? Number(raw) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`--${name} must be a non-negative number.`);
  }

  return Math.trunc(parsed);
}

function parseStringOption(args: string[], name: string): string | null {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`--${name} requires a value.`);
  }

  return value;
}

export function parseCliOptions(args: string[]): CliOptions {
  const manifestPath = parseStringOption(args, 'manifest');
  if (!manifestPath) {
    throw new Error('Usage: tsx src/scripts/import-japanese-audio-recognition-drafts.ts --manifest <file.jsonl> [--apply]');
  }

  return {
    manifestPath: path.resolve(manifestPath),
    baseUrl: parseStringOption(args, 'base-url') ?? DEFAULT_BASE_URL,
    apply: args.includes('--apply'),
    delayMs: parseNumberOption(args, 'delay-ms', DEFAULT_DELAY_MS),
    poll: args.includes('--poll'),
    pollIntervalMs: parseNumberOption(args, 'poll-interval-ms', DEFAULT_POLL_INTERVAL_MS),
    pollTimeoutMs: parseNumberOption(args, 'poll-timeout-ms', DEFAULT_POLL_TIMEOUT_MS),
  };
}

function printSummary(summary: ImportSummary): void {
  console.log(
    [
      `Rows: ${String(summary.totalRows)}`,
      `To queue: ${String(summary.toQueue)}`,
      `Queued now: ${String(summary.queued)}`,
      `Already queued: ${String(summary.alreadyQueued)}`,
      `Duplicates: ${String(summary.duplicates)}`,
      `Failed: ${String(summary.failed)}`,
      `Mode: ${summary.dryRun ? 'dry-run' : 'apply'}`,
    ].join('\n')
  );
}

async function pollQueuedDrafts(input: {
  client: ConvoLabDraftApiClient;
  queuedDraftIds: Set<string>;
  intervalMs: number;
  timeoutMs: number;
}): Promise<void> {
  if (input.queuedDraftIds.size === 0) return;

  const startedAt = Date.now();
  while (Date.now() - startedAt <= input.timeoutMs) {
    const drafts = await input.client.listDrafts();
    const queuedDrafts = drafts.filter((draft) => input.queuedDraftIds.has(draft.id));
    const ready = queuedDrafts.filter((draft) => draft.status === 'ready').length;
    const generating = queuedDrafts.filter((draft) => draft.status === 'generating').length;
    const error = queuedDrafts.filter((draft) => draft.status === 'error').length;
    console.log(
      `Draft status: ready=${String(ready)} generating=${String(generating)} error=${String(error)}`
    );
    if (generating === 0) return;
    await sleep(input.intervalMs);
  }

  console.log('Poll timeout reached while some drafts were still generating.');
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const client = options.apply
    ? new ConvoLabDraftApiClient({
        baseUrl: options.baseUrl,
        cookieHeader: process.env.CONVOLAB_PROD_COOKIE ?? '',
      })
    : undefined;

  const beforeEntries = await readManifest(options.manifestPath);
  const summary = await importManifestDrafts({
    manifestPath: options.manifestPath,
    apply: options.apply,
    client,
    delayMs: options.delayMs,
  });
  printSummary(summary);

  if (!options.apply) {
    console.log('Dry run only. Re-run with --apply to queue production drafts.');
    return;
  }

  if (options.poll && client) {
    const afterEntries = await readManifest(options.manifestPath);
    const beforeIds = new Set(
      beforeEntries
        .map((entry) => entry.row.queuedDraftId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    );
    const queuedDraftIds = new Set(
      afterEntries
        .map((entry) => entry.row.queuedDraftId)
        .filter(
          (id): id is string => typeof id === 'string' && id.length > 0 && !beforeIds.has(id)
        )
    );
    await pollQueuedDrafts({
      client,
      queuedDraftIds,
      intervalMs: options.pollIntervalMs,
      timeoutMs: options.pollTimeoutMs,
    });
  }
}

const executedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (executedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
