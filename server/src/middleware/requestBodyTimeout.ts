import type { RequestHandler } from 'express';

const DEFAULT_REQUEST_BODY_TIMEOUT_MS = 5 * 60 * 1000;
const LEARNING_OS_IMPORT_UPLOAD_PATH =
  /^\/api\/learning-os\/study\/imports\/[0-9A-HJKMNP-TV-Z]{26}\/upload$/i;

export function enforceDefaultRequestBodyTimeout(
  timeoutMs = DEFAULT_REQUEST_BODY_TIMEOUT_MS
): RequestHandler {
  return (req, res, next) => {
    if (req.method === 'PUT' && LEARNING_OS_IMPORT_UPLOAD_PATH.test(req.path)) {
      next();
      return;
    }

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
