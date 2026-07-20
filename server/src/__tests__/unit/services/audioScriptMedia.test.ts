import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getAudioScriptMediaAccess,
  getAudioScriptMediaApiPath,
} from '../../../services/audioScriptMediaService.js';
import { getPrivateMediaAccess } from '../../../services/privateMediaAccess.js';
import { mockPrisma } from '../../setup.js';

vi.mock('../../../services/privateMediaAccess.js', () => ({
  getPrivateMediaAccess: vi.fn(),
}));

describe('audio script media access', () => {
  beforeEach(() => {
    vi.mocked(getPrivateMediaAccess).mockResolvedValue(null);
  });

  it('builds an encoded Audio Script-owned API path', () => {
    expect(getAudioScriptMediaApiPath('media/id')).toBe('/api/scripts/media/media%2Fid');
  });

  it('looks up only media owned by the authenticated user', async () => {
    const media = {
      id: 'media-1',
      userId: 'user-1',
      sourceFilename: 'segment.webp',
      mediaKind: 'image',
      contentType: 'image/webp',
      storagePath: 'study-media/user-1/generated/segment.webp',
    };
    mockPrisma.audioScriptMedia.findFirst.mockResolvedValue(media);

    await getAudioScriptMediaAccess('user-1', 'media-1');

    expect(mockPrisma.audioScriptMedia.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'media-1',
        userId: 'user-1',
      },
    });
    expect(getPrivateMediaAccess).toHaveBeenCalledWith(media, {
      cacheNamespace: 'audio-script',
      logContext: 'AudioScript',
      mediaKind: media.mediaKind,
    });
  });

  it('keeps missing and cross-user media hidden behind the same null result', async () => {
    mockPrisma.audioScriptMedia.findFirst.mockResolvedValue(null);

    await expect(getAudioScriptMediaAccess('user-1', 'other-media')).resolves.toBeNull();
    expect(getPrivateMediaAccess).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ cacheNamespace: 'audio-script' })
    );
  });
});
