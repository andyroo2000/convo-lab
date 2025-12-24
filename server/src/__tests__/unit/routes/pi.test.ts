import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Create hoisted mocks
const mockGeneratePISession = vi.hoisted(() => vi.fn());
const mockSynthesizeBatchedTexts = vi.hoisted(() => vi.fn());
const mockUploadToGCS = vi.hoisted(() => vi.fn());
const mockRequireAuth = vi.hoisted(() =>
  vi.fn((req: any, res: any, next: any) => {
    req.userId = 'user-123';
    next();
  })
);
const mockBlockDemoUser = vi.hoisted(() =>
  vi.fn((req: any, res: any, next: any) => next())
);
const mockRequireEmailVerified = vi.hoisted(() =>
  vi.fn((req: any, res: any, next: any) => next())
);
const mockRateLimitGeneration = vi.hoisted(() =>
  vi.fn((req: any, res: any, next: any) => next())
);
const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  generationLog: {
    create: vi.fn(),
  },
}));

// Mock dependencies
vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../middleware/auth.js', () => ({
  requireAuth: mockRequireAuth,
  AuthRequest: class {},
}));

vi.mock('../../../middleware/emailVerification.js', () => ({
  requireEmailVerified: mockRequireEmailVerified,
}));

vi.mock('../../../middleware/rateLimit.js', () => ({
  rateLimitGeneration: mockRateLimitGeneration,
}));

vi.mock('../../../middleware/demoAuth.js', () => ({
  blockDemoUser: mockBlockDemoUser,
}));

vi.mock('../../../services/piGenerator.js', () => ({
  generatePISession: mockGeneratePISession,
  JLPTLevel: {},
  GrammarPointType: {},
  GRAMMAR_POINTS: {
    ha_vs_ga: { id: 'ha_vs_ga', name: 'は vs が', level: 'N5', category: 'particles' },
    ni_vs_de: { id: 'ni_vs_de', name: 'に vs で', level: 'N5', category: 'particles' },
    kara_vs_node: { id: 'kara_vs_node', name: '〜から vs 〜ので', level: 'N4', category: 'conjunctions' },
    teiru_aspect: { id: 'teiru_aspect', name: '〜ている', level: 'N4', category: 'aspect' },
    passive_vs_active: { id: 'passive_vs_active', name: 'Passive vs Active', level: 'N3', category: 'voice' },
    noni_vs_kedo: { id: 'noni_vs_kedo', name: 'のに vs けど', level: 'N2', category: 'conjunctions' },
  },
  isGrammarPointValidForLevel: vi.fn((grammarPoint: string, level: string) => {
    const grammarLevels: Record<string, string> = {
      ha_vs_ga: 'N5',
      ni_vs_de: 'N5',
      kara_vs_node: 'N4',
      teiru_aspect: 'N4',
      passive_vs_active: 'N3',
      noni_vs_kedo: 'N2',
    };
    return grammarLevels[grammarPoint] === level;
  }),
}));

vi.mock('../../../services/batchedTTSClient.js', () => ({
  synthesizeBatchedTexts: mockSynthesizeBatchedTexts,
}));

vi.mock('../../../services/storageClient.js', () => ({
  uploadToGCS: mockUploadToGCS,
}));

// Import after mocking
import piRouter from '../../../routes/pi.js';

describe('PI Routes', () => {
  let app: express.Application;

  const mockPISession = {
    jlptLevel: 'N5',
    grammarPoint: 'ha_vs_ga',
    grammarPointName: 'は vs が',
    items: [
      {
        type: 'sentence_meaning',
        japaneseSentence: 'これは本です。',
        englishTranslation: 'This is a book.',
        options: ['topic', 'subject'],
        correctOption: 'topic',
        explanation: 'は marks the topic of the sentence.',
      },
      {
        type: 'meaning_match',
        sentencePair: {
          sentenceA: '私は学生です。',
          sentenceB: '私が学生です。',
          translationA: 'I am a student (general statement).',
          translationB: 'I am the student (emphasis).',
        },
        options: ['topic/subject', 'subject/topic'],
        correctOption: 'topic/subject',
        explanation: 'は marks topic, が marks subject with emphasis.',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use('/api/pi', piRouter);

    // Default mock implementations
    mockGeneratePISession.mockResolvedValue(mockPISession);
    mockSynthesizeBatchedTexts.mockResolvedValue([
      Buffer.from('audio1'),
      Buffer.from('audio2'),
      Buffer.from('audio3'),
    ]);
    mockUploadToGCS.mockImplementation(async ({ filename }) => `https://storage.example.com/${filename}`);

    // Mock Prisma user lookup
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      emailVerified: true,
      role: 'user',
    });
    mockPrisma.generationLog.create.mockResolvedValue({
      id: 'log-1',
      userId: 'user-123',
      contentType: 'pi_session',
      contentId: null,
      createdAt: new Date(),
    });
  });

  describe('POST /api/pi/generate-session', () => {
    const validRequest = {
      jlptLevel: 'N5',
      itemCount: 10,
      grammarPoint: 'ha_vs_ga',
    };

    describe('authentication', () => {
      it('should require authentication', async () => {
        await request(app)
          .post('/api/pi/generate-session')
          .send(validRequest);

        expect(mockRequireAuth).toHaveBeenCalled();
      });

      it('should block demo users', async () => {
        await request(app)
          .post('/api/pi/generate-session')
          .send(validRequest);

        expect(mockBlockDemoUser).toHaveBeenCalled();
      });
    });

    describe('validation', () => {
      it('should reject invalid JLPT level', async () => {
        const response = await request(app)
          .post('/api/pi/generate-session')
          .send({
            jlptLevel: 'N6',
            itemCount: 10,
            grammarPoint: 'ha_vs_ga',
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid JLPT level');
      });

      it('should accept N5 level', async () => {
        const response = await request(app)
          .post('/api/pi/generate-session')
          .send({ ...validRequest, jlptLevel: 'N5' });

        expect(response.status).toBe(200);
      });

      it('should accept N4 level', async () => {
        mockGeneratePISession.mockResolvedValue({ ...mockPISession, jlptLevel: 'N4' });

        const response = await request(app)
          .post('/api/pi/generate-session')
          .send({ jlptLevel: 'N4', itemCount: 10, grammarPoint: 'kara_vs_node' });

        expect(response.status).toBe(200);
      });

      it('should accept N3 level', async () => {
        mockGeneratePISession.mockResolvedValue({ ...mockPISession, jlptLevel: 'N3' });

        const response = await request(app)
          .post('/api/pi/generate-session')
          .send({ jlptLevel: 'N3', itemCount: 10, grammarPoint: 'passive_vs_active' });

        expect(response.status).toBe(200);
      });

      it('should accept N2 level', async () => {
        mockGeneratePISession.mockResolvedValue({ ...mockPISession, jlptLevel: 'N2' });

        const response = await request(app)
          .post('/api/pi/generate-session')
          .send({ jlptLevel: 'N2', itemCount: 10, grammarPoint: 'noni_vs_kedo' });

        expect(response.status).toBe(200);
      });

      it('should reject invalid item count', async () => {
        const response = await request(app)
          .post('/api/pi/generate-session')
          .send({
            jlptLevel: 'N5',
            itemCount: 5,
            grammarPoint: 'ha_vs_ga',
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid item count');
      });

      it('should accept item count of 10', async () => {
        const response = await request(app)
          .post('/api/pi/generate-session')
          .send({ ...validRequest, itemCount: 10 });

        expect(response.status).toBe(200);
      });

      it('should accept item count of 15', async () => {
        const response = await request(app)
          .post('/api/pi/generate-session')
          .send({ ...validRequest, itemCount: 15 });

        expect(response.status).toBe(200);
      });

      it('should reject missing grammar point', async () => {
        const response = await request(app)
          .post('/api/pi/generate-session')
          .send({
            jlptLevel: 'N5',
            itemCount: 10,
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid grammar point');
      });

      it('should reject invalid grammar point', async () => {
        const response = await request(app)
          .post('/api/pi/generate-session')
          .send({
            jlptLevel: 'N5',
            itemCount: 10,
            grammarPoint: 'nonexistent_grammar',
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid grammar point');
      });

      it('should reject grammar point that does not match JLPT level', async () => {
        const response = await request(app)
          .post('/api/pi/generate-session')
          .send({
            jlptLevel: 'N5',
            itemCount: 10,
            grammarPoint: 'kara_vs_node', // This is N4
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('N4 level');
        expect(response.body.error).toContain('N5');
      });
    });

    describe('successful generation', () => {
      it('should call generatePISession with correct parameters', async () => {
        await request(app)
          .post('/api/pi/generate-session')
          .send(validRequest);

        expect(mockGeneratePISession).toHaveBeenCalledWith('N5', 10, 'ha_vs_ga');
      });

      it('should call synthesizeBatchedTexts for audio generation', async () => {
        await request(app)
          .post('/api/pi/generate-session')
          .send(validRequest);

        expect(mockSynthesizeBatchedTexts).toHaveBeenCalled();
        const callArgs = mockSynthesizeBatchedTexts.mock.calls[0];
        expect(callArgs[0]).toBeInstanceOf(Array);
        expect(callArgs[1]).toHaveProperty('voiceId', 'ja-JP-Neural2-B');
        expect(callArgs[1]).toHaveProperty('languageCode', 'ja-JP');
        expect(callArgs[1]).toHaveProperty('speed', 1.0);
      });

      it('should upload audio to GCS', async () => {
        await request(app)
          .post('/api/pi/generate-session')
          .send(validRequest);

        expect(mockUploadToGCS).toHaveBeenCalled();
        const uploadCalls = mockUploadToGCS.mock.calls;
        expect(uploadCalls.length).toBeGreaterThan(0);

        const firstCall = uploadCalls[0][0];
        expect(firstCall).toHaveProperty('buffer');
        expect(firstCall).toHaveProperty('filename');
        expect(firstCall).toHaveProperty('contentType', 'audio/mpeg');
        expect(firstCall).toHaveProperty('folder', 'pi-audio');
      });

      it('should return session with audio URLs', async () => {
        const response = await request(app)
          .post('/api/pi/generate-session')
          .send(validRequest);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('jlptLevel', 'N5');
        expect(response.body).toHaveProperty('grammarPoint', 'ha_vs_ga');
        expect(response.body).toHaveProperty('items');
        expect(response.body.items).toBeInstanceOf(Array);

        // Each item should have audioUrl
        response.body.items.forEach((item: any) => {
          expect(item).toHaveProperty('audioUrl');
          expect(item.audioUrl).toContain('https://storage.example.com/');
        });
      });

      it('should handle meaning_match items with dual audio URLs', async () => {
        const response = await request(app)
          .post('/api/pi/generate-session')
          .send(validRequest);

        expect(response.status).toBe(200);

        // Find meaning_match item
        const meaningMatchItem = response.body.items.find(
          (item: any) => item.type === 'meaning_match'
        );

        if (meaningMatchItem) {
          expect(meaningMatchItem).toHaveProperty('audioUrlA');
          expect(meaningMatchItem).toHaveProperty('audioUrlB');
        }
      });
    });

    describe('error handling', () => {
      it('should handle generatePISession errors', async () => {
        mockGeneratePISession.mockRejectedValue(new Error('Gemini API error'));

        const response = await request(app)
          .post('/api/pi/generate-session')
          .send(validRequest);

        expect(response.status).toBe(500);
        expect(response.body.error).toContain('Failed to generate PI session');
        expect(response.body.details).toBe('Gemini API error');
      });

      it('should handle TTS errors', async () => {
        mockSynthesizeBatchedTexts.mockRejectedValue(new Error('TTS service unavailable'));

        const response = await request(app)
          .post('/api/pi/generate-session')
          .send(validRequest);

        expect(response.status).toBe(500);
        expect(response.body.error).toContain('Failed to generate PI session');
      });

      it('should handle GCS upload errors', async () => {
        mockUploadToGCS.mockRejectedValue(new Error('Upload failed'));

        const response = await request(app)
          .post('/api/pi/generate-session')
          .send(validRequest);

        expect(response.status).toBe(500);
        expect(response.body.error).toContain('Failed to generate PI session');
      });
    });

    describe('audio generation flow', () => {
      it('should extract texts from sentence_meaning items', async () => {
        const singleItemSession = {
          ...mockPISession,
          items: [
            {
              type: 'sentence_meaning',
              japaneseSentence: 'これは本です。',
              englishTranslation: 'This is a book.',
              options: ['topic', 'subject'],
              correctOption: 'topic',
            },
          ],
        };
        mockGeneratePISession.mockResolvedValue(singleItemSession);
        mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);

        await request(app)
          .post('/api/pi/generate-session')
          .send(validRequest);

        const textsArg = mockSynthesizeBatchedTexts.mock.calls[0][0];
        expect(textsArg).toContain('これは本です。');
      });

      it('should extract texts from meaning_match items', async () => {
        const meaningMatchSession = {
          ...mockPISession,
          items: [
            {
              type: 'meaning_match',
              sentencePair: {
                sentenceA: 'Sentence A text',
                sentenceB: 'Sentence B text',
              },
              options: ['A', 'B'],
              correctOption: 'A',
            },
          ],
        };
        mockGeneratePISession.mockResolvedValue(meaningMatchSession);
        mockSynthesizeBatchedTexts.mockResolvedValue([
          Buffer.from('audioA'),
          Buffer.from('audioB'),
        ]);

        await request(app)
          .post('/api/pi/generate-session')
          .send(validRequest);

        const textsArg = mockSynthesizeBatchedTexts.mock.calls[0][0];
        expect(textsArg).toContain('Sentence A text');
        expect(textsArg).toContain('Sentence B text');
      });

      it('should batch all texts into single TTS call', async () => {
        await request(app)
          .post('/api/pi/generate-session')
          .send(validRequest);

        // Should only call TTS once (batched)
        expect(mockSynthesizeBatchedTexts).toHaveBeenCalledTimes(1);
      });
    });

    describe('response structure', () => {
      it('should return complete session structure', async () => {
        const response = await request(app)
          .post('/api/pi/generate-session')
          .send(validRequest);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('jlptLevel');
        expect(response.body).toHaveProperty('grammarPoint');
        expect(response.body).toHaveProperty('grammarPointName');
        expect(response.body).toHaveProperty('items');
      });

      it('should preserve original item structure with audio', async () => {
        const response = await request(app)
          .post('/api/pi/generate-session')
          .send(validRequest);

        const sentenceMeaningItem = response.body.items.find(
          (item: any) => item.type === 'sentence_meaning'
        );

        if (sentenceMeaningItem) {
          expect(sentenceMeaningItem).toHaveProperty('japaneseSentence');
          expect(sentenceMeaningItem).toHaveProperty('englishTranslation');
          expect(sentenceMeaningItem).toHaveProperty('options');
          expect(sentenceMeaningItem).toHaveProperty('correctOption');
          expect(sentenceMeaningItem).toHaveProperty('audioUrl');
        }
      });
    });
  });
});
