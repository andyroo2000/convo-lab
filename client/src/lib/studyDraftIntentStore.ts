import type {
  StudyManualCardDraft,
  StudyManualCardDraftUpdateRequest,
} from '@languageflow/shared/src/types';

const STORAGE_KEY_PREFIX = 'convolab.studyDraftIntent.v1.';

export interface StudyDraftIntent {
  version: 1;
  intentId: string;
  draftId: string;
  baseRevision: number;
  values: Omit<StudyManualCardDraftUpdateRequest, 'expectedRevision'>;
  createdAt: string;
}

type NewStudyDraftIntent = Pick<StudyDraftIntent, 'draftId' | 'baseRevision' | 'values'>;

function storageKey(draftId: string) {
  return `${STORAGE_KEY_PREFIX}${draftId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStudyDraftIntent(value: unknown, draftId: string): value is StudyDraftIntent {
  return (
    isRecord(value) &&
    value.version === 1 &&
    typeof value.intentId === 'string' &&
    value.intentId.length > 0 &&
    value.draftId === draftId &&
    typeof value.baseRevision === 'number' &&
    Number.isSafeInteger(value.baseRevision) &&
    value.baseRevision >= 0 &&
    isRecord(value.values) &&
    typeof value.createdAt === 'string'
  );
}

function createIntentId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function readStudyDraftIntent(draftId: string): StudyDraftIntent | null {
  const key = storageKey(draftId);
  const stored = window.localStorage.getItem(key);
  if (!stored) return null;

  try {
    const value: unknown = JSON.parse(stored);
    if (isStudyDraftIntent(value, draftId)) return value;
  } catch {
    // Corrupt storage cannot be recovered safely.
  }

  window.localStorage.removeItem(key);
  return null;
}

export function writeStudyDraftIntent(input: NewStudyDraftIntent): StudyDraftIntent {
  const intent: StudyDraftIntent = {
    version: 1,
    intentId: createIntentId(),
    draftId: input.draftId,
    baseRevision: input.baseRevision,
    values: input.values,
    createdAt: new Date().toISOString(),
  };
  window.localStorage.setItem(storageKey(input.draftId), JSON.stringify(intent));
  return intent;
}

export function acknowledgeStudyDraftIntent(intent: StudyDraftIntent, revision: number): void {
  const current = readStudyDraftIntent(intent.draftId);
  if (!current) return;

  if (current.intentId === intent.intentId) {
    window.localStorage.removeItem(storageKey(intent.draftId));
    return;
  }

  if (current.baseRevision === intent.baseRevision) {
    window.localStorage.setItem(
      storageKey(intent.draftId),
      JSON.stringify({ ...current, baseRevision: revision })
    );
  }
}

export function clearStudyDraftIntent(intent: StudyDraftIntent): void {
  const current = readStudyDraftIntent(intent.draftId);
  if (current?.intentId === intent.intentId) {
    window.localStorage.removeItem(storageKey(intent.draftId));
  }
}

export function removeStudyDraftIntent(draftId: string): void {
  window.localStorage.removeItem(storageKey(draftId));
}

export function isStudyDraftIntentApplied(
  intent: StudyDraftIntent,
  draft: StudyManualCardDraft
): boolean {
  return Object.entries(intent.values).every(([field, value]) => {
    if (field === 'expectedRevision') return true;
    return JSON.stringify(draft[field as keyof StudyManualCardDraft]) === JSON.stringify(value);
  });
}
