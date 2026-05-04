import type {
  StudyBrowserSortDirection,
  StudyBrowserSortField,
} from '@languageflow/shared/src/types.js';
import { Prisma } from '@prisma/client';

import { AppError } from '../../middleware/errorHandler.js';

import type { StudyBrowserCursor } from './shared.js';

export const STUDY_BROWSER_SORT_FIELDS = new Set<StudyBrowserSortField>([
  'created_on',
  'updated_on',
  'sort_field',
  'note_type',
  'card_count',
  'review_count',
]);

export const STUDY_BROWSER_SORT_DIRECTIONS = new Set<StudyBrowserSortDirection>(['asc', 'desc']);

export function getStudyBrowserSort(input: {
  sortField?: StudyBrowserSortField;
  sortDirection?: StudyBrowserSortDirection;
}) {
  return {
    sortField: input.sortField ?? 'created_on',
    sortDirection: input.sortDirection ?? 'desc',
  };
}

export function buildStudyBrowserSortExpression(input: {
  sortField: StudyBrowserSortField;
  userId: string;
}) {
  switch (input.sortField) {
    case 'created_on':
      return Prisma.sql`n."createdAt"`;
    case 'updated_on':
      return Prisma.sql`n."updatedAt"`;
    case 'sort_field':
      return Prisma.sql`LOWER(COALESCE(n."searchText", ''))`;
    case 'note_type':
      return Prisma.sql`LOWER(COALESCE(n."sourceNotetypeName", ''))`;
    case 'card_count':
      return Prisma.sql`(
        SELECT COUNT(*)
        FROM "study_cards" c_count
        WHERE c_count."noteId" = n.id
          AND c_count."userId" = ${input.userId}
      )`;
    case 'review_count':
      return Prisma.sql`(
        SELECT COUNT(*)
        FROM "study_review_logs" r_count
        JOIN "study_cards" rc_count ON rc_count.id = r_count."cardId"
        WHERE rc_count."noteId" = n.id
          AND r_count."userId" = ${input.userId}
      )`;
  }
}

export function normalizeStudyBrowserCursor(input: {
  cursor: StudyBrowserCursor | null;
  sortField: StudyBrowserSortField;
  sortDirection: StudyBrowserSortDirection;
}): string | number | Date | null {
  const { cursor, sortField, sortDirection } = input;
  if (!cursor) return null;

  if (cursor.updatedAt) {
    if (sortField === 'updated_on' && sortDirection === 'desc') {
      return new Date(cursor.updatedAt);
    }

    return null;
  }

  if (cursor.sortField !== sortField || cursor.sortDirection !== sortDirection) {
    throw new AppError('cursor is invalid for the current sort.', 400);
  }

  if (sortField === 'created_on' || sortField === 'updated_on') {
    const date = new Date(String(cursor.sortValue));
    if (Number.isNaN(date.getTime())) {
      throw new AppError('cursor is invalid.', 400);
    }
    return date;
  }

  if (sortField === 'card_count' || sortField === 'review_count') {
    const value = Number(cursor.sortValue);
    if (!Number.isFinite(value)) {
      throw new AppError('cursor is invalid.', 400);
    }
    return value;
  }

  return String(cursor.sortValue ?? '');
}

export function serializeStudyBrowserSortValue(value: unknown): string | number {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value === 'number' || typeof value === 'string') {
    return value;
  }
  return String(value ?? '');
}
