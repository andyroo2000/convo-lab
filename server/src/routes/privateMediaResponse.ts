import path from 'node:path';

import type { Response } from 'express';

import type { PrivateMediaAccessResult } from '../services/privateMediaAccess.js';

function sanitizeDownloadFilename(filename: string): string {
  const basename = path.basename(filename);
  const sanitized = basename.replace(/[^A-Za-z0-9._-]/g, '_');
  return sanitized.length > 0 ? sanitized : 'private-media';
}

function toSafeContentDisposition(
  contentDisposition: 'inline' | 'attachment',
  filename: string
): string {
  const disposition = contentDisposition === 'attachment' ? 'attachment' : 'inline';
  return `${disposition}; filename="${sanitizeDownloadFilename(filename)}"`;
}

export function sendPrivateMediaResponse(
  res: Response,
  mediaAccess: PrivateMediaAccessResult
): void {
  if (mediaAccess.type === 'redirect') {
    res.redirect(302, mediaAccess.redirectUrl);
    return;
  }

  res.type(mediaAccess.contentType);
  res.sendFile(mediaAccess.absolutePath, {
    headers: {
      // Callers must mint a new media row and URL whenever bytes change.
      'Cache-Control': 'private, max-age=15552000, immutable',
      'Content-Disposition': toSafeContentDisposition(
        mediaAccess.contentDisposition,
        mediaAccess.filename
      ),
    },
  });
}
