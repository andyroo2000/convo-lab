import type { RequestHandler } from 'express';

const DEFAULT_REQUEST_BODY_TIMEOUT_MS = 5 * 60 * 1000;

export function enforceDefaultRequestBodyTimeout(
  timeoutMs = DEFAULT_REQUEST_BODY_TIMEOUT_MS
): RequestHandler {
  return (req, res, next) => {
    const timeout = setTimeout(() => {
      if (req.complete) {
        return;
      }

      res.status(408).end();
      req.destroy();
    }, timeoutMs);
    const clearRequestTimeout = () => clearTimeout(timeout);

    req.once('end', clearRequestTimeout);
    req.once('close', clearRequestTimeout);
    next();
  };
}
