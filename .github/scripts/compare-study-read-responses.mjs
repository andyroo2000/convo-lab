import assert from 'node:assert/strict';

const OVERVIEW_COUNT_FIELDS = [
  'dueCount',
  'failedCount',
  'newCount',
  'newCardsPerDay',
  'newCardsIntroducedToday',
  'newCardsAvailableToday',
  'learningCount',
  'reviewCount',
  'suspendedCount',
  'totalCards',
];

const CARD_TYPES = new Set(['recognition', 'production', 'cloze']);
const COMPARISON_MODES = new Set([
  'strict',
  'opaque-cursor',
  'overview-state',
  'new-queue-state',
]);
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value) {
  return (
    typeof value === 'string' &&
    ISO_TIMESTAMP_PATTERN.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

export function parseFramedResponses(input) {
  const fields = input.trimEnd().split('\n');
  if (fields.length !== 2) {
    throw new Error('Expected exactly two framed parity responses.');
  }

  try {
    return fields.map((encoded) => JSON.parse(Buffer.from(encoded, 'base64')));
  } catch {
    throw new Error('Legacy or Learning OS response is not valid JSON.');
  }
}

function normalizeOverviewState(response) {
  if (!isRecord(response)) {
    throw new Error('Overview response must be a JSON object.');
  }

  const normalized = { ...response };
  for (const field of OVERVIEW_COUNT_FIELDS) {
    const value = response[field];
    if (!isNonNegativeInteger(value)) {
      throw new Error(`Overview field ${field} must be a non-negative integer.`);
    }
    normalized[field] = `<independent-state:${field}>`;
  }

  if (
    response.nextDueAt !== null &&
    !isIsoTimestamp(response.nextDueAt)
  ) {
    throw new Error('Overview field nextDueAt must be null or an ISO timestamp.');
  }
  normalized.nextDueAt = '<independent-state:nextDueAt>';

  return normalized;
}

function normalizeNewQueueState(response) {
  if (!isRecord(response)) {
    throw new Error('New Queue response must be a JSON object.');
  }
  if (!Array.isArray(response.items)) {
    throw new Error('New Queue field items must be an array.');
  }

  for (const [index, value] of response.items.entries()) {
    const field = `items[${index}]`;
    if (!isRecord(value)) {
      throw new Error(`New Queue field ${field} must be a JSON object.`);
    }
    if (typeof value.id !== 'string' || typeof value.noteId !== 'string') {
      throw new Error(`New Queue field ${field} must include string id and noteId values.`);
    }
    if (!CARD_TYPES.has(value.cardType)) {
      throw new Error(`New Queue field ${field}.cardType is invalid.`);
    }
    if (typeof value.displayText !== 'string') {
      throw new Error(`New Queue field ${field}.displayText must be a string.`);
    }
    if (value.meaning !== null && typeof value.meaning !== 'string') {
      throw new Error(`New Queue field ${field}.meaning must be null or a string.`);
    }
    if (value.queuePosition !== null && !isNonNegativeInteger(value.queuePosition)) {
      throw new Error(`New Queue field ${field}.queuePosition must be null or a non-negative integer.`);
    }
    if (!isIsoTimestamp(value.createdAt) || !isIsoTimestamp(value.updatedAt)) {
      throw new Error(`New Queue field ${field} must include ISO createdAt and updatedAt timestamps.`);
    }
  }

  if (!isNonNegativeInteger(response.total) || response.total < response.items.length) {
    throw new Error('New Queue field total must be a valid non-negative item count.');
  }
  if (!isNonNegativeInteger(response.limit) || response.items.length > response.limit) {
    throw new Error('New Queue field limit must be a valid non-negative page limit.');
  }
  if (response.nextCursor !== null && typeof response.nextCursor !== 'string') {
    throw new Error('New Queue field nextCursor must be null or a string.');
  }

  return {
    ...response,
    items: '<independent-state:items>',
    total: '<independent-state:total>',
    nextCursor: '<independent-state:nextCursor>',
  };
}

export function normalizeResponse(response, mode) {
  if (!COMPARISON_MODES.has(mode)) {
    throw new Error(`Unknown response comparison mode: ${mode}`);
  }

  if (mode === 'opaque-cursor') {
    return {
      ...response,
      nextCursor: response.nextCursor === null ? null : '<opaque-cursor>',
    };
  }

  if (mode === 'overview-state') {
    return normalizeOverviewState(response);
  }

  if (mode === 'new-queue-state') {
    return normalizeNewQueueState(response);
  }

  return response;
}

export function differingPaths(actual, expected, path = '$') {
  if (Object.is(actual, expected)) return [];
  if (
    actual === null ||
    expected === null ||
    typeof actual !== 'object' ||
    typeof expected !== 'object' ||
    Array.isArray(actual) !== Array.isArray(expected)
  ) {
    return [path];
  }
  if (Array.isArray(actual) && actual.length !== expected.length) {
    return [`${path}.length`];
  }

  const keys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
  return [...keys].flatMap((key) =>
    key in actual && key in expected
      ? differingPaths(actual[key], expected[key], `${path}.${key}`)
      : [`${path}.${key}`]
  );
}

export function compareResponses(proxyResponse, legacyResponse, mode = 'strict') {
  const normalizedProxy = normalizeResponse(proxyResponse, mode);
  const normalizedLegacy = normalizeResponse(legacyResponse, mode);

  try {
    assert.deepStrictEqual(normalizedProxy, normalizedLegacy);
  } catch {
    const paths = differingPaths(normalizedProxy, normalizedLegacy);
    throw new Error(
      `Legacy and Learning OS response contracts differ.\nDiffering JSON paths: ${paths
        .slice(0, 50)
        .join(', ')}`
    );
  }
}

export async function compareFramedResponsesFromStdin(mode = process.env.COMPARISON_MODE ?? 'strict') {
  process.stdin.setEncoding('utf8');
  let input = '';
  for await (const chunk of process.stdin) input += chunk;

  const [legacyResponse, proxyResponse] = parseFramedResponses(input);
  compareResponses(proxyResponse, legacyResponse, mode);
}

if (process.env.STUDY_RESPONSE_COMPARISON_CLI === 'true') {
  try {
    await compareFramedResponsesFromStdin();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
