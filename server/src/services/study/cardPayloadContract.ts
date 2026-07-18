import { AppError } from '../../middleware/errorHandler.js';

const MAX_STUDY_CARD_PAYLOAD_BYTES = 64 * 1024;
const MAX_STUDY_CARD_PAYLOAD_DEPTH = 8;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exceedsMaxJsonDepth(
  value: unknown,
  maxDepth: number,
  currentDepth = 1,
  seen: WeakSet<object> = new WeakSet()
): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  if (currentDepth > maxDepth) {
    return true;
  }
  if (seen.has(value)) {
    return false;
  }

  seen.add(value);
  return Object.values(value).some((child) =>
    exceedsMaxJsonDepth(child, maxDepth, currentDepth + 1, seen)
  );
}

export function assertStudyCardPayloadContract(
  prompt: unknown,
  answer: unknown
): { prompt: Record<string, unknown>; answer: Record<string, unknown> } {
  if (!isPlainObject(prompt) || !isPlainObject(answer)) {
    throw new AppError('prompt and answer payloads are required.', 400);
  }

  if (
    exceedsMaxJsonDepth(prompt, MAX_STUDY_CARD_PAYLOAD_DEPTH) ||
    exceedsMaxJsonDepth(answer, MAX_STUDY_CARD_PAYLOAD_DEPTH)
  ) {
    throw new AppError(
      `Study card payloads must be ${String(MAX_STUDY_CARD_PAYLOAD_DEPTH)} levels deep or fewer.`,
      400
    );
  }

  const serializedPayload = JSON.stringify({ prompt, answer });
  if (
    typeof serializedPayload !== 'string' ||
    Buffer.byteLength(serializedPayload, 'utf8') > MAX_STUDY_CARD_PAYLOAD_BYTES
  ) {
    throw new AppError(
      `Study card payloads must be ${String(MAX_STUDY_CARD_PAYLOAD_BYTES / 1024)} KB or smaller.`,
      400
    );
  }

  return { prompt, answer };
}
