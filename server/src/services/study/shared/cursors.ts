import { AppError } from '../../../middleware/errorHandler.js';

import { isRecord } from './guards.js';
import type { StudyBrowserCursor, StudyExportCursor } from './types.js';

export function encodeStudyBrowserCursor(cursor: StudyBrowserCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeStudyBrowserCursor(cursor: string): StudyBrowserCursor {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
    if (!isRecord(parsed) || typeof parsed.id !== 'string') {
      throw new Error('Invalid cursor');
    }

    // Support pre-sort cursors emitted before browser sorting added sort metadata.
    if (
      typeof parsed.updatedAt === 'string' &&
      !Number.isNaN(new Date(parsed.updatedAt).getTime())
    ) {
      return {
        updatedAt: parsed.updatedAt,
        id: parsed.id,
      };
    }

    if (
      typeof parsed.sortField !== 'string' ||
      typeof parsed.sortDirection !== 'string' ||
      (typeof parsed.sortValue !== 'string' && typeof parsed.sortValue !== 'number')
    ) {
      throw new Error('Invalid cursor');
    }

    return {
      sortField: parsed.sortField as StudyBrowserCursor['sortField'],
      sortDirection: parsed.sortDirection as StudyBrowserCursor['sortDirection'],
      sortValue: parsed.sortValue,
      id: parsed.id,
    };
  } catch {
    throw new AppError('cursor is invalid.', 400);
  }
}

export function encodeStudyExportCursor(cursor: StudyExportCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeStudyExportCursor(cursor: string): StudyExportCursor {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
    if (
      !isRecord(parsed) ||
      typeof parsed.timestamp !== 'string' ||
      typeof parsed.id !== 'string' ||
      Number.isNaN(new Date(parsed.timestamp).getTime())
    ) {
      throw new Error('Invalid cursor');
    }

    return {
      timestamp: parsed.timestamp,
      id: parsed.id,
    };
  } catch {
    throw new AppError('cursor is invalid.', 400);
  }
}
