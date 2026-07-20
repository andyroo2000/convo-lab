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
