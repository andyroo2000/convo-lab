import type {
  StudyImportResult,
  StudyImportUploadReadiness,
  StudyImportUploadSession,
} from '@languageflow/shared/src/types';

import { requestJson } from './apiClient';
import { CSRF_TOKEN_HEADER_NAME, getCsrfToken } from './csrf';
import {
  isJsonRecord,
  nullableStringValue,
  numberValue,
  stringValue,
  unwrapLearningOsData,
} from './learningOsResponseNormalization';
import { studyApiPath } from './studyApi';

type StudyImportStatus = StudyImportResult['status'];
type StudyImportJobId = StudyImportResult['id'];
type UploadProgressOptions = {
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
};

const studyImportStatuses = new Set<StudyImportStatus>([
  'pending',
  'processing',
  'completed',
  'failed',
]);

function requestStudyImport<T>(endpoint: string, init?: RequestInit): Promise<T> {
  return requestJson<T>(studyApiPath(endpoint), init);
}

function normalizeStudyImportPreview(value: unknown): StudyImportResult['preview'] {
  const preview = isJsonRecord(value) ? value : {};
  const breakdownValue = preview.noteTypeBreakdown ?? preview.note_type_breakdown;
  const warningsValue = preview.warnings;

  return {
    deckName: stringValue(preview, 'deckName', 'deck_name'),
    cardCount: numberValue(preview, 'cardCount', 'card_count'),
    noteCount: numberValue(preview, 'noteCount', 'note_count'),
    reviewLogCount: numberValue(preview, 'reviewLogCount', 'review_log_count'),
    mediaReferenceCount: numberValue(preview, 'mediaReferenceCount', 'media_reference_count'),
    skippedMediaCount: numberValue(preview, 'skippedMediaCount', 'skipped_media_count'),
    warnings: Array.isArray(warningsValue)
      ? warningsValue.filter((warning): warning is string => typeof warning === 'string')
      : [],
    noteTypeBreakdown: Array.isArray(breakdownValue)
      ? breakdownValue.filter(isJsonRecord).map((item) => ({
          notetypeName: stringValue(item, 'notetypeName', 'notetype_name'),
          noteCount: numberValue(item, 'noteCount', 'note_count'),
          cardCount: numberValue(item, 'cardCount', 'card_count'),
        }))
      : [],
  };
}

function normalizeStudyImportStatus(value: unknown): StudyImportStatus {
  if (typeof value === 'string' && studyImportStatuses.has(value as StudyImportStatus)) {
    return value as StudyImportStatus;
  }
  throw new Error('Study import response contained an invalid status.');
}

function normalizeSourceSize(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeStudyImportResult(value: unknown): StudyImportResult {
  const result = unwrapLearningOsData(value);
  if (!isJsonRecord(result)) {
    throw new Error('Study import response was malformed.');
  }

  const id = stringValue(result, 'id', 'id');
  if (!id) {
    throw new Error('Study import response did not include an id.');
  }

  return {
    id,
    status: normalizeStudyImportStatus(result.status),
    sourceFilename: stringValue(result, 'sourceFilename', 'source_filename'),
    deckName: stringValue(result, 'deckName', 'deck_name'),
    preview: normalizeStudyImportPreview(result.preview),
    uploadedAt: nullableStringValue(result, 'uploadedAt', 'uploaded_at'),
    uploadExpiresAt: nullableStringValue(result, 'uploadExpiresAt', 'upload_expires_at'),
    sourceSizeBytes: normalizeSourceSize(result.sourceSizeBytes ?? result.source_size_bytes),
    importedAt: nullableStringValue(result, 'importedAt', 'completed_at'),
    errorMessage: nullableStringValue(result, 'errorMessage', 'error_message'),
  };
}

function normalizeUploadHeaders(value: unknown): Record<string, string> {
  if (!isJsonRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  );
}

function normalizeUpload(value: unknown): StudyImportUploadSession['upload'] {
  if (!isJsonRecord(value)) {
    throw new Error('Study import upload session was malformed.');
  }
  if (value.method !== 'PUT' || typeof value.url !== 'string') {
    throw new Error('Study import upload session was malformed.');
  }
  return {
    method: 'PUT',
    url: value.url,
    headers: normalizeUploadHeaders(value.headers),
  };
}

export async function createStudyImportUploadSession(
  file: File
): Promise<StudyImportUploadSession> {
  const response = await requestStudyImport<unknown>('/imports', {
    method: 'POST',
    body: JSON.stringify({
      filename: file.name,
      content_type: file.type || 'application/octet-stream',
    }),
  });
  const session = unwrapLearningOsData(response);
  if (!isJsonRecord(session)) {
    throw new Error('Study import upload session was malformed.');
  }

  return {
    importJob: normalizeStudyImportResult(session.importJob ?? session.import_job),
    upload: normalizeUpload(session.upload),
  };
}

function uploadProgress(event: ProgressEvent): number | null {
  if (!event.lengthComputable || event.total <= 0) return null;
  return Math.min(1, event.loaded / event.total);
}

function reportUploadProgress(event: ProgressEvent, onProgress?: (progress: number) => void) {
  const progress = uploadProgress(event);
  if (progress === null) return;
  if (typeof onProgress !== 'function') return;
  onProgress(progress);
}

export async function uploadStudyImportArchive(
  session: StudyImportUploadSession,
  file: File,
  options: UploadProgressOptions = {}
): Promise<void> {
  const csrfToken = await getCsrfToken();
  if (!csrfToken) {
    throw new Error('Unable to initialize secure upload.');
  }

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const abortHandler = () => request.abort();
    if (options.signal?.aborted) {
      reject(new Error('Upload cancelled'));
      return;
    }

    request.open(session.upload.method, session.upload.url);
    Object.entries(session.upload.headers).forEach(([headerName, headerValue]) => {
      request.setRequestHeader(headerName, headerValue);
    });
    request.setRequestHeader(CSRF_TOKEN_HEADER_NAME, csrfToken);
    options.signal?.addEventListener('abort', abortHandler, { once: true });

    const cleanup = () => options.signal?.removeEventListener('abort', abortHandler);
    request.upload.onprogress = (event) => reportUploadProgress(event, options.onProgress);
    request.onerror = () => {
      cleanup();
      reject(new Error('Upload failed'));
    };
    request.onabort = () => {
      cleanup();
      reject(new Error('Upload cancelled'));
    };
    request.onload = () => {
      cleanup();
      if (request.status >= 200 && request.status < 300) {
        options.onProgress?.(1);
        resolve();
        return;
      }
      reject(new Error(`Upload failed (${String(request.status)})`));
    };
    request.send(file);
  });
}

export async function completeStudyImportUpload(
  importJobId: StudyImportJobId
): Promise<StudyImportResult> {
  return normalizeStudyImportResult(
    await requestStudyImport<unknown>(`/imports/${encodeURIComponent(importJobId)}/complete`, {
      method: 'POST',
    })
  );
}

export async function cancelStudyImportUpload(
  importJobId: StudyImportJobId
): Promise<StudyImportResult> {
  return normalizeStudyImportResult(
    await requestStudyImport<unknown>(`/imports/${encodeURIComponent(importJobId)}/cancel`, {
      method: 'POST',
    })
  );
}

export async function getCurrentStudyImport(
  init?: Pick<RequestInit, 'signal'>
): Promise<StudyImportResult | null> {
  const response = unwrapLearningOsData(
    await requestStudyImport<unknown>('/imports/current', init)
  );
  return response === null || typeof response === 'undefined'
    ? null
    : normalizeStudyImportResult(response);
}

export async function getStudyImportUploadReadiness(): Promise<StudyImportUploadReadiness> {
  const response = unwrapLearningOsData(await requestStudyImport<unknown>('/imports/readiness'));
  if (!isJsonRecord(response)) {
    throw new Error('Study import readiness response was malformed.');
  }
  return {
    ready: response.ready === true,
    message: typeof response.message === 'string' ? response.message : null,
  };
}

export async function getStudyImportStatus(
  importJobId: StudyImportJobId,
  init?: Pick<RequestInit, 'signal'>
): Promise<StudyImportResult> {
  return normalizeStudyImportResult(
    await requestStudyImport<unknown>(`/imports/${encodeURIComponent(importJobId)}`, init)
  );
}

export async function uploadStudyImport(file: File): Promise<StudyImportResult> {
  const session = await createStudyImportUploadSession(file);
  await uploadStudyImportArchive(session, file);
  return completeStudyImportUpload(session.importJob.id);
}
