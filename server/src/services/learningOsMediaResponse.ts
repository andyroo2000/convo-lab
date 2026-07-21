import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import type { Response } from 'express';

import { AppError } from '../middleware/errorHandler.js';

const FORWARDED_MEDIA_RESPONSE_HEADERS = [
  'accept-ranges',
  'cache-control',
  'content-disposition',
  'content-length',
  'content-range',
  'content-type',
  'etag',
  'last-modified',
] as const;

interface LearningOsMediaContract {
  invalidHeadersMessage: string;
  isAllowedContentType: (contentType: string) => boolean;
}

const safeMediaResponseHeader = (name: string, value: string): boolean => {
  if (value.length === 0 || value.length > 1024 || /[\r\n]/.test(value)) {
    return false;
  }

  return name !== 'content-length' || /^\d+$/.test(value);
};

export async function streamLearningOsMediaResponse(
  upstreamResponse: globalThis.Response,
  res: Response,
  contract: LearningOsMediaContract
): Promise<void> {
  const contentType = upstreamResponse.headers.get('content-type');
  if (
    !contentType ||
    !safeMediaResponseHeader('content-type', contentType) ||
    !contract.isAllowedContentType(contentType)
  ) {
    throw new AppError(contract.invalidHeadersMessage, 502);
  }

  for (const name of FORWARDED_MEDIA_RESPONSE_HEADERS) {
    const value = upstreamResponse.headers.get(name);
    if (value !== null && safeMediaResponseHeader(name, value)) {
      res.setHeader(name, value);
    }
  }
  res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(upstreamResponse.status);

  if (!upstreamResponse.body) {
    res.end();
    return;
  }

  await pipeline(
    Readable.fromWeb(upstreamResponse.body as Parameters<typeof Readable.fromWeb>[0]),
    res
  );
}
