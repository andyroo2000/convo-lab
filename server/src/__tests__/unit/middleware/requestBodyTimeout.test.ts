import { EventEmitter } from 'node:events';

import type { NextFunction } from 'express';
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
    const next = vi.fn() as unknown as NextFunction;

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

    enforceDefaultRequestBodyTimeout(100)(
      req as never,
      res as never,
      vi.fn() as unknown as NextFunction
    );
    req.complete = true;
    req.emit('end');
    vi.advanceTimersByTime(100);

    expect(res.status).not.toHaveBeenCalled();
    expect(req.destroy).not.toHaveBeenCalled();
  });

  it('applies the deadline to retired and canonical Learning OS upload paths', () => {
    vi.useFakeTimers();
    const retiredUpload = request(
      '/api/learning-os/study/imports/01ARZ3NDEKTSV4RRFFQ69G5FAW/upload',
      'PUT'
    );
    const canonicalUpload = request('/api/study/imports/01ARZ3NDEKTSV4RRFFQ69G5FAW/upload', 'PUT');

    enforceDefaultRequestBodyTimeout(100)(
      retiredUpload.req as never,
      retiredUpload.res as never,
      vi.fn() as unknown as NextFunction
    );
    enforceDefaultRequestBodyTimeout(100)(
      canonicalUpload.req as never,
      canonicalUpload.res as never,
      vi.fn() as unknown as NextFunction
    );
    vi.advanceTimersByTime(100);

    expect(retiredUpload.res.status).toHaveBeenCalledWith(408);
    expect(canonicalUpload.res.status).toHaveBeenCalledWith(408);
  });
});
