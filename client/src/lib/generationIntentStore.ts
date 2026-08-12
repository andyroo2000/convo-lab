const STORAGE_KEY_PREFIX = 'convolab.generationIntent.v1.';

export type GenerationIntentKind = 'dialogue' | 'course';

export interface GenerationIntent<TPayload extends object = Record<string, unknown>> {
  version: 1;
  intentId: string;
  ownerId: string;
  kind: GenerationIntentKind;
  payload: TPayload;
  createdAt: string;
}

export class GenerationIntentStorageError extends Error {
  constructor(
    message: string,
    public readonly cause: unknown
  ) {
    super(message);
    this.name = 'GenerationIntentStorageError';
  }
}

function storageKey(ownerId: string, kind: GenerationIntentKind): string {
  return `${STORAGE_KEY_PREFIX}${encodeURIComponent(ownerId)}.${kind}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isGenerationIntent(
  value: unknown,
  ownerId: string,
  kind: GenerationIntentKind
): value is GenerationIntent {
  return (
    isRecord(value) &&
    value.version === 1 &&
    typeof value.intentId === 'string' &&
    value.intentId.length > 0 &&
    value.ownerId === ownerId &&
    value.kind === kind &&
    isRecord(value.payload) &&
    typeof value.createdAt === 'string'
  );
}

function createUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  throw new GenerationIntentStorageError(
    'This browser cannot safely create a retryable generation request.',
    null
  );
}

export function readGenerationIntent<TPayload extends object>(
  ownerId: string,
  kind: GenerationIntentKind
): GenerationIntent<TPayload> | null {
  const key = storageKey(ownerId, kind);
  let stored: string | null;
  try {
    stored = window.localStorage.getItem(key);
  } catch (error) {
    throw new GenerationIntentStorageError('Could not read the saved generation request.', error);
  }
  if (!stored) return null;

  try {
    const parsed: unknown = JSON.parse(stored);
    if (isGenerationIntent(parsed, ownerId, kind)) {
      return parsed as GenerationIntent<TPayload>;
    }
  } catch (error) {
    throw new GenerationIntentStorageError('The saved generation request is corrupt.', error);
  }

  throw new GenerationIntentStorageError(
    'The saved generation request has an unsupported format.',
    null
  );
}

export function writeGenerationIntent<TPayload extends object>(
  ownerId: string,
  kind: GenerationIntentKind,
  payload: TPayload
): GenerationIntent<TPayload> {
  const intent: GenerationIntent<TPayload> = {
    version: 1,
    intentId: createUuid(),
    ownerId,
    kind,
    payload,
    createdAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(storageKey(ownerId, kind), JSON.stringify(intent));
  } catch (error) {
    throw new GenerationIntentStorageError('Could not save the generation request.', error);
  }
  return intent;
}

export function acknowledgeGenerationIntent<TPayload extends object>(
  intent: GenerationIntent<TPayload>
): void {
  const current = readGenerationIntent(intent.ownerId, intent.kind);
  if (current?.intentId !== intent.intentId) return;

  try {
    window.localStorage.removeItem(storageKey(intent.ownerId, intent.kind));
  } catch (error) {
    throw new GenerationIntentStorageError(
      'The generation request was accepted, but its saved retry could not be cleared.',
      error
    );
  }
}

// Conflicts are deliberately retained until the user chooses to abandon the saved request.
// Acknowledgement and abandonment share the same compare-and-remove safety rule.
export const abandonGenerationIntent = acknowledgeGenerationIntent;
