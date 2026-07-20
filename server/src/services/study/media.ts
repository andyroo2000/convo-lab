import { prisma } from '../../db/client.js';
import { getPrivateMediaAccess } from '../privateMediaAccess.js';

export async function getStudyMediaAccess(userId: string, mediaId: string) {
  const media = await prisma.studyMedia.findFirst({
    where: {
      id: mediaId,
      userId,
    },
  });

  return getPrivateMediaAccess(media, {
    cacheNamespace: 'study',
    logContext: 'Study',
    mediaKind: media?.mediaKind ?? 'other',
  });
}
