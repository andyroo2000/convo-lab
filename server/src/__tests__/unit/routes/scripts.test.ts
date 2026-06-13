import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAudioScriptStatusMock } = vi.hoisted(() => ({
  getAudioScriptStatusMock: vi.fn(),
}));

vi.mock('../../../jobs/audioScriptQueue.js', () => ({
  audioScriptQueue: {
    add: vi.fn(),
    getJob: vi.fn(),
  },
}));

vi.mock('../../../jobs/imageQueue.js', () => ({
  imageQueue: {
    add: vi.fn(),
  },
}));

vi.mock('../../../services/audioScriptService.js', () => ({
  annotateAudioScript: vi.fn(),
  createAudioScript: vi.fn(),
  getAudioScriptStatus: getAudioScriptStatusMock,
  toAudioScriptResponse: vi.fn((script) => script),
  updateAudioScriptSegments: vi.fn(),
}));

vi.mock('../../../services/usageTracker.js', () => ({
  logGeneration: vi.fn(),
}));

vi.mock('../../../services/workerTrigger.js', () => ({
  triggerWorkerJob: vi.fn(),
}));

import { assertAudioScriptJobBelongsToUser } from '../../../routes/scripts.js';

describe('Scripts Route Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /job/:jobId ownership', () => {
    it('allows status reads only for jobs owned by the current user', async () => {
      getAudioScriptStatusMock.mockResolvedValue({ id: 'script-1' });

      await expect(
        assertAudioScriptJobBelongsToUser(
          { data: { episodeId: 'episode-1', userId: 'user-1' } },
          'user-1'
        )
      ).resolves.toBeUndefined();

      expect(getAudioScriptStatusMock).toHaveBeenCalledWith('episode-1', 'user-1');
    });

    it('rejects guessed script render job IDs from another user', async () => {
      await expect(
        assertAudioScriptJobBelongsToUser(
          { data: { episodeId: 'episode-1', userId: 'other-user' } },
          'user-1'
        )
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Script audio job not found.',
      });

      expect(getAudioScriptStatusMock).not.toHaveBeenCalled();
    });

    it('preserves the script ownership check for matching job metadata', async () => {
      getAudioScriptStatusMock.mockRejectedValue(
        Object.assign(new Error('Script not found.'), { statusCode: 404 })
      );

      await expect(
        assertAudioScriptJobBelongsToUser(
          { data: { episodeId: 'episode-1', userId: 'user-1' } },
          'user-1'
        )
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});
