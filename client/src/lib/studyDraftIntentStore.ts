import type {
  StudyManualCardDraft,
  StudyManualCardDraftUpdateRequest,
} from '@languageflow/shared/src/types';

const STORAGE_KEY_PREFIX = 'convolab.studyDraftIntent.v2.';

export class StudyDraftIntentStorageError extends Error {
  constructor(
    message: string,
    public readonly cause: unknown
  ) {
    super(message);
    this.name = 'StudyDraftIntentStorageError';
  }
}

export interface StudyDraftIntent {
  version: 2;
  intentId: string;
  ownerId: string;
  draftId: string;
  baseRevision: number;
  values: Omit<StudyManualCardDraftUpdateRequest, 'expectedRevision'>;
  createdAt: string;
}

type NewStudyDraftIntent = Pick<
  StudyDraftIntent,
  'ownerId' | 'draftId' | 'baseRevision' | 'values'
>;

export function studyDraftIntentStorageKey(ownerId: string, draftId: string) {
  return `${STORAGE_KEY_PREFIX}${encodeURIComponent(ownerId)}.${draftId}`;
}

export function isStudyDraftIntentStorageKeyForOwner(key: string | null, ownerId: string) {
  return key?.startsWith(`${STORAGE_KEY_PREFIX}${encodeURIComponent(ownerId)}.`) ?? false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStudyDraftIntent(
  value: unknown,
  ownerId: string,
  draftId: string
): value is StudyDraftIntent {
  return (
    isRecord(value) &&
    value.version === 2 &&
    typeof value.intentId === 'string' &&
    value.intentId.length > 0 &&
    value.ownerId === ownerId &&
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

function structurallyEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => structurallyEqual(value, right[index]))
    );
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(right, key) && structurallyEqual(left[key], right[key])
    )
  );
}

export function createStudyDraftIntent(input: NewStudyDraftIntent): StudyDraftIntent {
  return {
    version: 2,
    intentId: createIntentId(),
    ownerId: input.ownerId,
    draftId: input.draftId,
    baseRevision: input.baseRevision,
    values: input.values,
    createdAt: new Date().toISOString(),
  };
}

export function readStudyDraftIntent(ownerId: string, draftId: string): StudyDraftIntent | null {
  const key = studyDraftIntentStorageKey(ownerId, draftId);
  let stored: string | null;
  try {
    stored = window.localStorage.getItem(key);
  } catch (error) {
    throw new StudyDraftIntentStorageError('Could not read the saved draft edit.', error);
  }
  if (!stored) return null;

  try {
    const value: unknown = JSON.parse(stored);
    if (isStudyDraftIntent(value, ownerId, draftId)) return value;
  } catch (error) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // The original corruption error is the actionable failure.
    }
    throw new StudyDraftIntentStorageError('The saved draft edit was corrupt.', error);
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // The invalid payload remains isolated to this owner and draft.
  }
  throw new StudyDraftIntentStorageError('The saved draft edit had an unsupported format.', null);
}

export function persistStudyDraftIntent(intent: StudyDraftIntent): void {
  try {
    window.localStorage.setItem(
      studyDraftIntentStorageKey(intent.ownerId, intent.draftId),
      JSON.stringify(intent)
    );
  } catch (error) {
    throw new StudyDraftIntentStorageError('Could not store the latest draft edit.', error);
  }
}

export function writeStudyDraftIntent(input: NewStudyDraftIntent): StudyDraftIntent {
  const intent = createStudyDraftIntent(input);
  persistStudyDraftIntent(intent);
  return intent;
}

export function removeStudyDraftIntent(ownerId: string, draftId: string): void {
  try {
    window.localStorage.removeItem(studyDraftIntentStorageKey(ownerId, draftId));
  } catch (error) {
    throw new StudyDraftIntentStorageError('Could not remove the saved draft edit.', error);
  }
}

export function acknowledgeStudyDraftIntent(intent: StudyDraftIntent): void {
  const current = readStudyDraftIntent(intent.ownerId, intent.draftId);
  if (current?.intentId === intent.intentId) {
    removeStudyDraftIntent(intent.ownerId, intent.draftId);
  }
}

export function clearStudyDraftIntent(intent: StudyDraftIntent): void {
  const current = readStudyDraftIntent(intent.ownerId, intent.draftId);
  if (current?.intentId === intent.intentId) {
    removeStudyDraftIntent(intent.ownerId, intent.draftId);
  }
}

export function isStudyDraftIntentApplied(
  intent: StudyDraftIntent,
  draft: StudyManualCardDraft
): boolean {
  return Object.entries(intent.values).every(([field, value]) =>
    structurallyEqual(draft[field as keyof StudyManualCardDraft], value)
  );
}
