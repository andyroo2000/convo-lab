export type JsonRecord = Record<string, unknown>;
export interface PersistedStudyMediaRecord {
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

export interface CachedStudyMediaRedirect {
  url: string;
  expiresAtMs: number;
}

export interface StudyMediaAccessResult {
  type: 'local' | 'redirect';
  absolutePath?: string;
  redirectUrl?: string;
  contentType: string;
  contentDisposition: 'inline' | 'attachment';
  filename: string;
}
