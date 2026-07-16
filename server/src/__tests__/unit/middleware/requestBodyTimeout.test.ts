import { EventEmitter } from 'node:events';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { enforceDefaultRequestBodyTimeout } from '../../../middleware/requestBodyTimeout.js';

function request(path: string, method = 'POST') {
  const req = Object.assign(new EventEmitter(), {
    complete: false,
    destroy: vi.fn(),
    method,
    path,
  });
  const end = vi.fn();
  const res = {
    status: vi.fn(() => ({ end })),
  };

  return { req, res, end };
}

describe('request body timeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('terminates an incomplete ordinary request at the default route deadline', () => {
    vi.useFakeTimers();
    const { req, res, end } = request('/api/study/imports');
    const next = vi.fn();

    enforceDefaultRequestBodyTimeout(100)(req as never, res as never, next);
    vi.advanceTimersByTime(100);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(408);
    expect(end).toHaveBeenCalledOnce();
    expect(req.destroy).toHaveBeenCalledOnce();
  });

  it('clears the deadline when the request body completes', () => {
    vi.useFakeTimers();
    const { req, res } = request('/api/study/imports');

    enforceDefaultRequestBodyTimeout(100)(req as never, res as never, vi.fn());
    req.complete = true;
    req.emit('end');
    vi.advanceTimersByTime(100);

    expect(res.status).not.toHaveBeenCalled();
    expect(req.destroy).not.toHaveBeenCalled();
  });

  it('leaves only strict Learning OS import uploads on the extended server deadline', () => {
    vi.useFakeTimers();
    const validUpload = request(
      '/api/learning-os/study/imports/01ARZ3NDEKTSV4RRFFQ69G5FAW/upload',
      'PUT'
    );
    const invalidUpload = request('/api/learning-os/study/imports/not-an-id/upload', 'PUT');

    enforceDefaultRequestBodyTimeout(100)(
      validUpload.req as never,
      validUpload.res as never,
      vi.fn()
    );
    enforceDefaultRequestBodyTimeout(100)(
      invalidUpload.req as never,
      invalidUpload.res as never,
      vi.fn()
    );
    vi.advanceTimersByTime(100);

    expect(validUpload.res.status).not.toHaveBeenCalled();
    expect(invalidUpload.res.status).toHaveBeenCalledWith(408);
  });
});
