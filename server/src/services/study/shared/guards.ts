import { Prisma } from '@prisma/client';

import type { JsonRecord } from './types.js';

function stripNullChars(value: string): string {
  return value.replaceAll('\0', '');
}

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

export function sanitizeText(value: string | null | undefined): string | null {
  if (value === null || typeof value === 'undefined') return null;
  return stripNullChars(value);
}

function sanitizeJsonValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return stripNullChars(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonValue(item));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeJsonValue(item)])
    );
  }

  return value;
}

export function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return sanitizeJsonValue(value) as Prisma.InputJsonValue;
}
