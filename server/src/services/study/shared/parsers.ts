import { isRecord } from './guards.js';
import type { PersistedStudyMediaRecord } from './types.js';

export function parsePersistedStudyMediaRecord(value: unknown): PersistedStudyMediaRecord | null {
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
