import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAudioScriptMediaAccessMock, getAudioScriptStatusMock } = vi.hoisted(() => ({
  getAudioScriptMediaAccessMock: vi.fn(),
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

vi.mock('../../../services/audioScriptMediaService.js', () => ({
  getAudioScriptMediaAccess: getAudioScriptMediaAccessMock,
}));

vi.mock('../../../middleware/auth.js', () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { userId: string }).userId = 'user-1';
    next();
  },
  AuthRequest: class {},
}));

vi.mock('../../../middleware/studyRateLimit.js', () => ({
  rateLimitStudyRoute: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../../services/usageTracker.js', () => ({
  logGeneration: vi.fn(),
}));

vi.mock('../../../services/workerTrigger.js', () => ({
  triggerWorkerJob: vi.fn(),
}));

import scriptsRouter, {
  assertAudioScriptJobBelongsToUser,
  parseAudioScriptSegmentsPatchBody,
} from '../../../routes/scripts.js';

describe('Scripts Route Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /media/:mediaId', () => {
    function buildApp() {
      const app = express();
      app.use('/api/scripts', scriptsRouter);
      app.use(
        (
          error: Error & { statusCode?: number },
          _req: Request,
          res: Response,
          _next: NextFunction
        ) => {
          res.status(error.statusCode ?? 500).json({ message: error.message });
        }
      );
      return app;
    }

    it('serves only media resolved for the authenticated owner', async () => {
      getAudioScriptMediaAccessMock.mockResolvedValue({
        type: 'redirect',
        redirectUrl: 'https://storage.example.com/segment.webp',
        contentType: 'image/webp',
        contentDisposition: 'inline',
        filename: 'segment.webp',
      });

      const response = await request(buildApp()).get('/api/scripts/media/media-1');

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('https://storage.example.com/segment.webp');
      expect(getAudioScriptMediaAccessMock).toHaveBeenCalledWith('user-1', 'media-1');
    });

    it('returns the same hidden 404 for missing or cross-user media', async () => {
      getAudioScriptMediaAccessMock.mockResolvedValue(null);

      const response = await request(buildApp()).get('/api/scripts/media/other-media');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Script media not found.');
    });
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

  describe('PATCH /:episodeId/segments validation', () => {
    it('accepts trimmed title and known Google Neural2 voice IDs', () => {
      const payload = parseAudioScriptSegmentsPatchBody({
        title: '  My Script  ',
        voiceId: ' ja-JP-Neural2-D ',
        segments: [
          {
            text: '日本に住んでいます。',
            reading: '日本[にほん]に住[す]んでいます。',
            translation: 'I live in Japan.',
          },
        ],
      });

      expect(payload.title).toBe('My Script');
      expect(payload.voiceId).toBe('ja-JP-Neural2-D');
      expect(payload.segments).toHaveLength(1);
    });

    it('rejects empty titles and unsupported voices before service mutation', () => {
      expect(() => parseAudioScriptSegmentsPatchBody({ title: '   ', segments: [] })).toThrowError(
        'title must be a non-empty string when provided.'
      );

      expect(() =>
        parseAudioScriptSegmentsPatchBody({
          voiceId: 'ja-JP-Wavenet-A',
          segments: [],
        })
      ).toThrowError('voiceId must be a supported Google Neural2 Japanese voice.');
    });
  });
});
