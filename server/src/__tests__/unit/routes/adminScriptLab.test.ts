import express, {
  json as expressJson,
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { errorHandler } from '../../../middleware/errorHandler.js';
import adminScriptLabRouter from '../../../routes/adminScriptLab.js';

// Hoisted mocks
const mockPrisma = vi.hoisted(() => ({
  sentenceScriptTest: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

const mockGenerateSentenceScript = vi.hoisted(() => vi.fn());

vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../services/scriptLabSentenceGenerator.js', () => ({
  generateSentenceScript: mockGenerateSentenceScript,
}));

// Mock auth middleware to simulate admin user
vi.mock('../../../middleware/auth.js', () => ({
  requireAuth: (req: Request & { userId?: string }, _res: Response, next: NextFunction) => {
    req.userId = 'admin-user-id';
    next();
  },
  AuthRequest: class {},
}));

vi.mock('../../../middleware/roleAuth.js', () => ({
  requireAdmin: (_req: Request, _res: Response, next: NextFunction) => {
    next();
  },
  requireRole: (_role: string) => (_req: Request, _res: Response, next: NextFunction) => {
    next();
  },
}));

// Mock external services that are imported but not under test
vi.mock('../../../services/geminiClient.js', () => ({
  generateWithGemini: vi.fn(),
}));
vi.mock('../../../services/pronunciation/overrideEngine.js', () => ({
  applyJapanesePronunciationOverrides: vi.fn(),
}));
vi.mock('../../../services/storageClient.js', () => ({
  uploadToGCS: vi.fn(),
}));
vi.mock('../../../services/ttsProviders/FishAudioTTSProvider.js', () => ({
  synthesizeFishAudioSpeech: vi.fn(),
  resolveFishAudioVoiceId: vi.fn((v: string) => v),
}));

describe('Admin Script Lab - Sentence Script Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(expressJson());
    app.use('/api/admin/script-lab', adminScriptLabRouter);
    app.use(errorHandler);
  });

  describe('POST /api/admin/script-lab/sentence-script', () => {
    const validBody = {
      sentence: '東京に行きました',
      translation: 'I went to Tokyo',
      targetLanguage: 'ja',
      nativeLanguage: 'en',
      jlptLevel: 'N4',
    };

    it('should return generated script and persisted testId', async () => {
      const mockResult = {
        units: [
          { type: 'narration_L1', text: "Here's how you say went", voiceId: 'en-voice' },
          { type: 'L2', text: '行きました', reading: 'いきました', voiceId: 'ja-voice' },
        ],
        estimatedDurationSeconds: 15,
        rawResponse: '{}',
        resolvedPrompt: 'resolved prompt',
        translation: 'I went to Tokyo',
      };
      mockGenerateSentenceScript.mockResolvedValue(mockResult);
      mockPrisma.sentenceScriptTest.create.mockResolvedValue({ id: 'test-id-1', ...mockResult });

      const response = await request(app)
        .post('/api/admin/script-lab/sentence-script')
        .send(validBody)
        .expect(200);

      expect(response.body.testId).toBe('test-id-1');
      expect(response.body.units).toHaveLength(2);
      expect(response.body.resolvedPrompt).toBe('resolved prompt');
    });

    it('should persist to DB with correct fields', async () => {
      const mockResult = {
        units: [{ type: 'L2', text: '東京', voiceId: 'ja-voice' }],
        estimatedDurationSeconds: 10,
        rawResponse: '{"units":[]}',
        resolvedPrompt: 'the prompt',
        translation: 'I went to Tokyo',
      };
      mockGenerateSentenceScript.mockResolvedValue(mockResult);
      mockPrisma.sentenceScriptTest.create.mockResolvedValue({ id: 'test-id-2' });

      await request(app).post('/api/admin/script-lab/sentence-script').send(validBody).expect(200);

      expect(mockPrisma.sentenceScriptTest.create).toHaveBeenCalledWith({
        data: {
          userId: 'admin-user-id',
          sentence: '東京に行きました',
          translation: 'I went to Tokyo',
          targetLanguage: 'ja',
          nativeLanguage: 'en',
          jlptLevel: 'N4',
          l1VoiceId: expect.any(String),
          l2VoiceId: expect.any(String),
          promptTemplate: 'the prompt',
          unitsJson: mockResult.units,
          rawResponse: '{"units":[]}',
          estimatedDurationSecs: 10,
          parseError: null,
        },
      });
    });

    it('should return 400 when sentence is missing', async () => {
      const response = await request(app)
        .post('/api/admin/script-lab/sentence-script')
        .send({ translation: 'test' })
        .expect(400);

      expect(response.body.error.message).toBe('sentence is required');
    });

    it('should return 400 when sentence is empty string', async () => {
      const response = await request(app)
        .post('/api/admin/script-lab/sentence-script')
        .send({ sentence: '   ' })
        .expect(400);

      expect(response.body.error.message).toBe('sentence is required');
    });

    it('should use default voice IDs when none provided', async () => {
      const mockResult = {
        units: [],
        estimatedDurationSeconds: 0,
        rawResponse: '{}',
        resolvedPrompt: 'prompt',
        translation: null,
      };
      mockGenerateSentenceScript.mockResolvedValue(mockResult);
      mockPrisma.sentenceScriptTest.create.mockResolvedValue({ id: 'test-id-3' });

      await request(app)
        .post('/api/admin/script-lab/sentence-script')
        .send({ sentence: 'テスト' })
        .expect(200);

      // generateSentenceScript should be called with default voice IDs
      expect(mockGenerateSentenceScript).toHaveBeenCalledWith(
        expect.objectContaining({
          l1VoiceId: expect.stringContaining('fishaudio:'),
          l2VoiceId: expect.stringContaining('fishaudio:'),
        })
      );
    });
  });

  describe('GET /api/admin/script-lab/sentence-tests', () => {
    it('should return paginated list with summary fields', async () => {
      const mockTests = [
        {
          id: 'test-1',
          sentence: 'テスト',
          translation: 'test',
          estimatedDurationSecs: 10,
          parseError: null,
          createdAt: new Date('2025-01-01'),
        },
        {
          id: 'test-2',
          sentence: 'テスト2',
          translation: 'test 2',
          estimatedDurationSecs: 12,
          parseError: null,
          createdAt: new Date('2025-01-02'),
        },
      ];
      mockPrisma.sentenceScriptTest.findMany.mockResolvedValue(mockTests);

      const response = await request(app).get('/api/admin/script-lab/sentence-tests').expect(200);

      expect(response.body.tests).toHaveLength(2);
      expect(response.body.nextCursor).toBeNull();
      expect(response.body.tests[0]).toHaveProperty('id');
      expect(response.body.tests[0]).toHaveProperty('sentence');
    });

    it('should support cursor-based pagination', async () => {
      // Return limit+1 items to indicate there are more
      const mockTests = Array.from({ length: 51 }, (_, i) => ({
        id: `test-${i}`,
        sentence: `テスト${i}`,
        translation: `test ${i}`,
        estimatedDurationSecs: 10,
        parseError: null,
        createdAt: new Date(),
      }));
      mockPrisma.sentenceScriptTest.findMany.mockResolvedValue(mockTests);

      const response = await request(app)
        .get('/api/admin/script-lab/sentence-tests?cursor=test-0')
        .expect(200);

      expect(response.body.tests).toHaveLength(50);
      expect(response.body.nextCursor).toBe('test-49');

      // Verify cursor was passed to prisma
      expect(mockPrisma.sentenceScriptTest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'test-0' },
          skip: 1,
        })
      );
    });
  });

  describe('GET /api/admin/script-lab/sentence-tests/:id', () => {
    it('should return full test record', async () => {
      const mockTest = {
        id: 'test-1',
        sentence: 'テスト',
        translation: 'test',
        rawResponse: '{}',
        promptTemplate: 'the prompt',
        unitsJson: [{ type: 'L2', text: 'テスト' }],
        estimatedDurationSecs: 10,
        createdAt: new Date('2025-01-01'),
      };
      mockPrisma.sentenceScriptTest.findUnique.mockResolvedValue(mockTest);

      const response = await request(app)
        .get('/api/admin/script-lab/sentence-tests/test-1')
        .expect(200);

      expect(response.body.id).toBe('test-1');
      expect(response.body.rawResponse).toBe('{}');
      expect(response.body.promptTemplate).toBe('the prompt');
    });

    it('should return 404 for non-existent ID', async () => {
      mockPrisma.sentenceScriptTest.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/admin/script-lab/sentence-tests/nonexistent')
        .expect(404);

      expect(response.body.error.message).toBe('Sentence test not found');
    });
  });

  describe('DELETE /api/admin/script-lab/sentence-tests', () => {
    it('should delete records by IDs and return deleted count', async () => {
      mockPrisma.sentenceScriptTest.deleteMany.mockResolvedValue({ count: 3 });

      const response = await request(app)
        .delete('/api/admin/script-lab/sentence-tests')
        .send({ ids: ['test-1', 'test-2', 'test-3'] })
        .expect(200);

      expect(response.body.deleted).toBe(3);
      expect(mockPrisma.sentenceScriptTest.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['test-1', 'test-2', 'test-3'] } },
      });
    });

    it('should return 400 when ids array is empty', async () => {
      const response = await request(app)
        .delete('/api/admin/script-lab/sentence-tests')
        .send({ ids: [] })
        .expect(400);

      expect(response.body.error.message).toBe('ids array is required');
    });

    it('should return 400 when ids is missing', async () => {
      const response = await request(app)
        .delete('/api/admin/script-lab/sentence-tests')
        .send({})
        .expect(400);

      expect(response.body.error.message).toBe('ids array is required');
    });
  });
});
