import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compareResponses,
  normalizeResponse,
  parseFramedResponses,
} from './compare-study-read-responses.mjs';

const overview = {
  dueCount: 3,
  failedCount: 2,
  newCount: 11,
  newCardsPerDay: 40,
  newCardsIntroducedToday: 4,
  newCardsAvailableToday: 8,
  learningCount: 5,
  reviewCount: 100,
  suspendedCount: 6,
  totalCards: 127,
  latestImport: { id: 'import-1', status: 'completed' },
  nextDueAt: '2026-07-16T12:00:00.000Z',
};

test('parses newline-framed base64 JSON responses', () => {
  const encoded = (value) => Buffer.from(JSON.stringify(value)).toString('base64');

  assert.deepEqual(parseFramedResponses(`${encoded({ value: 1 })}\n${encoded({ value: 2 })}\n`), [
    { value: 1 },
    { value: 2 },
  ]);
});

test('strict mode reports differing response paths', () => {
  assert.throws(
    () => compareResponses({ nested: { value: 2 } }, { nested: { value: 1 } }),
    /Differing JSON paths: \$\.nested\.value/
  );
});

test('opaque cursor mode ignores cursor encoding but preserves nullability', () => {
  compareResponses({ rows: [], nextCursor: 'new' }, { rows: [], nextCursor: 'legacy' }, 'opaque-cursor');

  assert.throws(
    () => compareResponses({ rows: [], nextCursor: null }, { rows: [], nextCursor: 'legacy' }, 'opaque-cursor'),
    /Differing JSON paths: \$\.nextCursor/
  );
});

test('overview state mode allows copied databases to evolve independently', () => {
  compareResponses(
    {
      ...overview,
      dueCount: 428,
      failedCount: 134,
      newCardsPerDay: 20,
      nextDueAt: null,
    },
    overview,
    'overview-state'
  );
});

test('overview state mode keeps stable response fields strict', () => {
  assert.throws(
    () =>
      compareResponses(
        { ...overview, latestImport: { id: 'import-2', status: 'completed' } },
        overview,
        'overview-state'
      ),
    /Differing JSON paths: \$\.latestImport\.id/
  );
});

test('overview state mode validates independently evolving field types', () => {
  assert.throws(
    () => normalizeResponse({ ...overview, dueCount: '3' }, 'overview-state'),
    /Overview field dueCount must be a non-negative integer/
  );
  assert.throws(
    () => normalizeResponse({ ...overview, nextDueAt: 'tomorrow' }, 'overview-state'),
    /Overview field nextDueAt must be null or an ISO timestamp/
  );
});
