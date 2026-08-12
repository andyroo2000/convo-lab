import { JsonRequestError } from './apiClient';

export type GenerationRequestState = 'pending' | 'active' | 'completed' | 'failed';

export interface GenerationRequestAcknowledgement {
  clientRequestId: string;
  state: GenerationRequestState;
  jobId: string;
  message: string;
  courseId?: string;
}

interface GenerationRequestConflictPayload {
  code: 'idempotency_conflict' | 'content_gone';
  message: string;
}

interface FailedGenerationRequestPayload {
  clientRequestId: string;
  state: 'failed';
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isGenerationRequestConflict(
  error: unknown
): error is JsonRequestError & { payload: GenerationRequestConflictPayload } {
  return (
    error instanceof JsonRequestError &&
    (error.status === 409 || error.status === 410) &&
    isRecord(error.payload) &&
    (error.payload.code === 'idempotency_conflict' || error.payload.code === 'content_gone') &&
    typeof error.payload.message === 'string'
  );
}

export function isAcknowledgedGenerationFailure(
  error: unknown,
  clientRequestId: string
): error is JsonRequestError & { payload: FailedGenerationRequestPayload } {
  return (
    error instanceof JsonRequestError &&
    isRecord(error.payload) &&
    error.payload.clientRequestId === clientRequestId &&
    error.payload.state === 'failed' &&
    typeof error.payload.message === 'string'
  );
}

export function isDefinitiveGenerationRejection(error: unknown): error is JsonRequestError {
  return (
    error instanceof JsonRequestError &&
    error.status >= 400 &&
    error.status < 500 &&
    !isGenerationRequestConflict(error)
  );
}

export function generationRequestErrorMessage(error: unknown, fallback: string): string {
  if (isGenerationRequestConflict(error)) {
    return `${error.payload.message} Start a new request or contact support if this keeps happening.`;
  }
  return error instanceof Error ? error.message : fallback;
}
