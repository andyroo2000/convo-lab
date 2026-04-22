import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { deleteFromGCSPath } from '../../storageClient.js';

import { STUDY_MEDIA_REDIRECT_CACHE_MAX_ENTRIES } from './constants.js';
import { sanitizeText } from './guards.js';
import type { CachedStudyMediaRedirect } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function stripNullChars(value: string): string {
  return value.replaceAll('\0', '');
}

export function normalizeFilename(filename: string): string {
  const base = path.basename(stripNullChars(filename));
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function normalizeZipPath(value: string): string {
  return stripNullChars(value).replaceAll('\\', '/').trim();
}

export function isUnsafeZipPath(value: string): boolean {
  const normalized = normalizeZipPath(value);
  if (!normalized) return true;
  if (normalized.startsWith('/')) return true;
  if (/^[a-zA-Z]:/.test(normalized)) return true;

  return normalized.split('/').some((segment) => segment === '.' || segment === '..');
}

export function isSafeZipBasename(value: string): boolean {
  const normalized = normalizeZipPath(value);
  return !isUnsafeZipPath(normalized) && !normalized.includes('/');
}

export function isAllowedStudyImportZipEntryName(value: string): boolean {
  const normalized = normalizeZipPath(value);
  return (
    normalized === 'collection.anki21b' ||
    normalized === 'collection.anki21' ||
    normalized === 'collection.anki2' ||
    normalized === 'media' ||
    isSafeZipBasename(normalized)
  );
}

export function sanitizePathSegment(value: string): string {
  const base = path.basename(stripNullChars(value));
  const normalized = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  return normalized.length > 0 ? normalized : 'unknown';
}

export function getPrivateStudyMediaRoot(): string {
  return path.join(__dirname, '../../../storage');
}

export function getLegacyPublicStudyMediaRoot(): string {
  return path.join(__dirname, '../../../public');
}

function normalizeStoragePath(storagePath: string): string {
  return path.posix.normalize(storagePath).replace(/^\/+/, '');
}

export const studyMediaRedirectCache = new Map<string, CachedStudyMediaRedirect>();

export function pruneStudyMediaRedirectCache(nowMs: number = Date.now()) {
  for (const [cacheKey, cached] of studyMediaRedirectCache.entries()) {
    if (cached.expiresAtMs <= nowMs) {
      studyMediaRedirectCache.delete(cacheKey);
    }
  }

  while (studyMediaRedirectCache.size > STUDY_MEDIA_REDIRECT_CACHE_MAX_ENTRIES) {
    const oldestKey = studyMediaRedirectCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    studyMediaRedirectCache.delete(oldestKey);
  }
}

export function resolveStudyMediaAbsolutePath(baseDir: string, storagePath: string): string | null {
  const normalizedStoragePath = normalizeStoragePath(storagePath);
  if (
    normalizedStoragePath.length === 0 ||
    isUnsafeZipPath(normalizedStoragePath) ||
    !normalizedStoragePath.startsWith('study-media/')
  ) {
    return null;
  }

  const candidate = path.resolve(baseDir, normalizedStoragePath);
  const resolvedBase = path.resolve(baseDir);

  if (!candidate.startsWith(`${resolvedBase}${path.sep}`) && candidate !== resolvedBase) {
    return null;
  }

  return candidate;
}

export async function findAccessibleLocalStudyMediaPath(
  storagePath: string
): Promise<string | null> {
  const candidatePaths = [
    resolveStudyMediaAbsolutePath(getPrivateStudyMediaRoot(), storagePath),
    resolveStudyMediaAbsolutePath(getLegacyPublicStudyMediaRoot(), storagePath),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidatePaths) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

export function hasConfiguredStudyGcsStorage(): boolean {
  return typeof process.env.GCS_BUCKET_NAME === 'string' && process.env.GCS_BUCKET_NAME.length > 0;
}

export async function deletePersistedStudyMediaByStoragePath(storagePath: string): Promise<void> {
  const normalizedStoragePath = normalizeStoragePath(storagePath);
  if (!normalizedStoragePath) {
    return;
  }

  if (hasConfiguredStudyGcsStorage()) {
    try {
      await deleteFromGCSPath(normalizedStoragePath);
    } catch (error) {
      console.warn('[Study] Failed to delete GCS study media:', error);
    }
  }

  const localPath = resolveStudyMediaAbsolutePath(
    getPrivateStudyMediaRoot(),
    normalizedStoragePath
  );
  if (!localPath) {
    return;
  }

  try {
    await fs.unlink(localPath);
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? String(error.code) : null;
    if (code !== 'ENOENT') {
      console.warn('[Study] Failed to delete local study media:', error);
    }
  }
}

export function getStudyMediaApiPath(mediaId: string): string {
  return `/api/study/media/${encodeURIComponent(mediaId)}`;
}

export function getDefaultAnkiMediaDirectory(): string | null {
  if (process.platform !== 'darwin') {
    return null;
  }

  // This macOS Anki path is a local development convenience fallback only.
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

export async function findLocalAnkiMediaFile(filename: string): Promise<string | null> {
  const configuredDir = sanitizeText(process.env.ANKI_MEDIA_DIR ?? '');
  const normalizedFilename = normalizeZipPath(filename);

  if (!isSafeZipBasename(normalizedFilename)) {
    return null;
  }

  const candidateDirs = [configuredDir, getDefaultAnkiMediaDirectory()].filter(
    (value): value is string => Boolean(value)
  );

  for (const dir of candidateDirs) {
    const resolvedDir = path.resolve(dir);
    const absolutePath = path.resolve(resolvedDir, normalizedFilename);

    if (!absolutePath.startsWith(`${resolvedDir}${path.sep}`) && absolutePath !== resolvedDir) {
      continue;
    }

    try {
      await fs.access(absolutePath);
      return absolutePath;
    } catch {
      continue;
    }
  }

  return null;
}

export function getContentType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'application/octet-stream';
}

export function getMediaKind(filename: string): 'audio' | 'image' | 'other' {
  const contentType = getContentType(filename);
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType.startsWith('image/')) return 'image';
  return 'other';
}
