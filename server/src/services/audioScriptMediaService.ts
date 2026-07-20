import { prisma } from '../db/client.js';

import { getPrivateMediaAccess } from './privateMediaAccess.js';

export function getAudioScriptMediaApiPath(mediaId: string): string {
  return `/api/scripts/media/${encodeURIComponent(mediaId)}`;
}

export async function getAudioScriptMediaAccess(userId: string, mediaId: string) {
  const media = await prisma.audioScriptMedia.findFirst({
    where: {
      id: mediaId,
      userId,
    },
  });

  return getPrivateMediaAccess(media, {
    cacheNamespace: 'audio-script',
    logContext: 'AudioScript',
    mediaKind: media?.mediaKind ?? 'other',
  });
}
