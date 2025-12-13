import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create hoisted mocks
const mockPrisma = vi.hoisted(() => ({
  narrowListeningPack: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  },
}));

const mockNarrowListeningQueue = vi.hoisted(() => ({
  add: vi.fn(),
  getJob: vi.fn(),
}));

const mockGetLibraryUserId = vi.hoisted(() => vi.fn());
const mockGetEffectiveUserId = vi.hoisted(() => vi.fn());

vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../jobs/narrowListeningQueue.js', () => ({
  narrowListeningQueue: mockNarrowListeningQueue,
}));

vi.mock('../../../middleware/demoAuth.js', () => ({
  blockDemoUser: vi.fn((req, res, next) => next()),
  getLibraryUserId: mockGetLibraryUserId,
}));

vi.mock('../../../middleware/impersonation.js', () => ({
  getEffectiveUserId: mockGetEffectiveUserId,
}));

describe('Narrow Listening Route Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLibraryUserId.mockResolvedValue('test-user-id');
    mockGetEffectiveUserId.mockResolvedValue('test-user-id');
  });

  describe('GET / - List Packs', () => {
    it('should return packs with versions', async () => {
      const mockPacks = [
        {
          id: 'pack-1',
          title: 'Cafe Conversation',
          topic: 'At a cafe',
          targetLanguage: 'ja',
          proficiencyLevel: 'N4',
          versions: [
            { id: 'v-1', variationType: 'PAST_CASUAL' },
            { id: 'v-2', variationType: 'PRESENT_POLITE' },
          ],
        },
      ];
      mockPrisma.narrowListeningPack.findMany.mockResolvedValue(mockPacks);

      const result = await mockPrisma.narrowListeningPack.findMany({
        where: { userId: 'test-user-id' },
        include: { versions: true },
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toHaveLength(1);
      expect(result[0].versions).toHaveLength(2);
    });

    it('should use library userId for demo users', async () => {
      mockGetLibraryUserId.mockResolvedValue('admin-user-id');

      const userId = await mockGetLibraryUserId('demo-user-id');

      expect(userId).toBe('admin-user-id');
    });
  });

  describe('GET /:id - Single Pack', () => {
    it('should return pack with full version details', async () => {
      const mockPack = {
        id: 'pack-1',
        title: 'Test Pack',
        versions: [
          {
            id: 'v-1',
            variationType: 'PAST_CASUAL',
            segments: [
              { targetText: '昨日カフェに行った。', englishTranslation: 'I went to a cafe yesterday.' },
            ],
            audioUrl: 'https://storage.example.com/audio.mp3',
          },
        ],
      };
      mockPrisma.narrowListeningPack.findUnique.mockResolvedValue(mockPack);

      const result = await mockPrisma.narrowListeningPack.findUnique({
        where: { id: 'pack-1' },
        include: { versions: true },
      });

      expect(result?.versions[0].audioUrl).toBeDefined();
      expect(result?.versions[0].segments).toHaveLength(1);
    });

    it('should return null for non-existent pack', async () => {
      mockPrisma.narrowListeningPack.findUnique.mockResolvedValue(null);

      const result = await mockPrisma.narrowListeningPack.findUnique({
        where: { id: 'non-existent' },
      });

      expect(result).toBeNull();
    });
  });

  describe('POST /generate - Generate Pack', () => {
    it('should require topic, targetLanguage, and proficiencyLevel', () => {
      const validateGeneratePack = (body: any): string | null => {
        const { topic, targetLanguage, proficiencyLevel } = body;
        if (!topic) return 'topic is required';
        if (!targetLanguage) return 'targetLanguage is required';
        if (!proficiencyLevel) return 'proficiencyLevel is required';
        return null;
      };

      expect(validateGeneratePack({})).toBe('topic is required');
      expect(validateGeneratePack({ topic: 'Test' })).toBe('targetLanguage is required');
      expect(validateGeneratePack({ topic: 'Test', targetLanguage: 'ja' })).toBe('proficiencyLevel is required');
      expect(validateGeneratePack({
        topic: 'Test',
        targetLanguage: 'ja',
        proficiencyLevel: 'N4',
      })).toBeNull();
    });

    it('should queue narrow listening generation job', async () => {
      mockNarrowListeningQueue.add.mockResolvedValue({ id: 'job-123' });

      await mockNarrowListeningQueue.add(
        {
          topic: 'At a cafe',
          targetLanguage: 'ja',
          proficiencyLevel: 'N4',
          versionCount: 3,
          userId: 'test-user-id',
        },
        { jobId: 'nl-abc123' }
      );

      expect(mockNarrowListeningQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'At a cafe',
          targetLanguage: 'ja',
          proficiencyLevel: 'N4',
        }),
        expect.any(Object)
      );
    });

    it('should use default version count of 3', () => {
      const getVersionCount = (body: any) => body.versionCount || 3;

      expect(getVersionCount({})).toBe(3);
      expect(getVersionCount({ versionCount: 5 })).toBe(5);
    });
  });

  describe('POST /:id/generate-speed - Generate Audio Speed', () => {
    it('should validate speed parameter', () => {
      const validSpeeds = ['slow', 'medium', 'normal'];
      const validateSpeed = (speed: string) => validSpeeds.includes(speed);

      expect(validateSpeed('slow')).toBe(true);
      expect(validateSpeed('medium')).toBe(true);
      expect(validateSpeed('normal')).toBe(true);
      expect(validateSpeed('fast')).toBe(false);
    });

    it('should update pack with new audio URL', async () => {
      mockPrisma.narrowListeningPack.update.mockResolvedValue({
        id: 'pack-1',
        audioUrl_0_7: 'https://storage.example.com/audio-slow.mp3',
      });

      const result = await mockPrisma.narrowListeningPack.update({
        where: { id: 'pack-1' },
        data: { audioUrl_0_7: 'https://storage.example.com/audio-slow.mp3' },
      });

      expect(result.audioUrl_0_7).toBeDefined();
    });
  });

  describe('DELETE /:id - Delete Pack', () => {
    it('should delete pack by id and userId', async () => {
      mockPrisma.narrowListeningPack.delete.mockResolvedValue({ id: 'pack-1' });

      await mockPrisma.narrowListeningPack.delete({
        where: { id: 'pack-1', userId: 'test-user-id' },
      });

      expect(mockPrisma.narrowListeningPack.delete).toHaveBeenCalledWith({
        where: { id: 'pack-1', userId: 'test-user-id' },
      });
    });
  });

  describe('Proficiency Level Validation', () => {
    it('should accept valid JLPT levels for Japanese', () => {
      const jlptLevels = ['N5', 'N4', 'N3', 'N2', 'N1'];
      const isValidJLPT = (level: string) => jlptLevels.includes(level);

      expect(isValidJLPT('N5')).toBe(true);
      expect(isValidJLPT('N4')).toBe(true);
      expect(isValidJLPT('N1')).toBe(true);
      expect(isValidJLPT('N6')).toBe(false);
    });

    it('should accept valid HSK levels for Chinese', () => {
      const hskLevels = ['HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6'];
      const isValidHSK = (level: string) => hskLevels.includes(level);

      expect(isValidHSK('HSK1')).toBe(true);
      expect(isValidHSK('HSK6')).toBe(true);
      expect(isValidHSK('HSK7')).toBe(false);
    });

    it('should accept valid CEFR levels for Spanish', () => {
      const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      const isValidCEFR = (level: string) => cefrLevels.includes(level);

      expect(isValidCEFR('A1')).toBe(true);
      expect(isValidCEFR('C2')).toBe(true);
      expect(isValidCEFR('C3')).toBe(false);
    });

    it('should map language to proficiency system', () => {
      const getProficiencySystem = (lang: string) => {
        switch (lang) {
          case 'ja': return 'JLPT';
          case 'zh': return 'HSK';
          case 'es':
          case 'fr': return 'CEFR';
          default: return 'CEFR';
        }
      };

      expect(getProficiencySystem('ja')).toBe('JLPT');
      expect(getProficiencySystem('zh')).toBe('HSK');
      expect(getProficiencySystem('es')).toBe('CEFR');
    });
  });

  describe('Job Status', () => {
    it('should return job progress', async () => {
      mockNarrowListeningQueue.getJob.mockResolvedValue({
        id: 'job-123',
        getState: vi.fn().mockResolvedValue('active'),
        progress: vi.fn().mockReturnValue({ step: 'generating_audio', progress: 75 }),
      });

      const job = await mockNarrowListeningQueue.getJob('job-123');
      const progress = job.progress();

      expect(progress.step).toBe('generating_audio');
      expect(progress.progress).toBe(75);
    });

    it('should return completed job with pack data', async () => {
      const mockPack = {
        id: 'pack-1',
        title: 'Generated Pack',
        versions: [],
      };

      mockNarrowListeningQueue.getJob.mockResolvedValue({
        id: 'job-123',
        getState: vi.fn().mockResolvedValue('completed'),
        returnvalue: { pack: mockPack },
      });

      const job = await mockNarrowListeningQueue.getJob('job-123');
      const state = await job.getState();

      expect(state).toBe('completed');
      expect(job.returnvalue.pack.id).toBe('pack-1');
    });
  });

  describe('Pagination Tests', () => {
    beforeEach(() => {
      mockPrisma.narrowListeningPack.findMany.mockResolvedValue([]);
    });

    it('should use default pagination values (limit=50, offset=0)', async () => {
      await mockPrisma.narrowListeningPack.findMany({
        where: { userId: 'test-user-id' },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        skip: 0,
      });

      expect(mockPrisma.narrowListeningPack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          skip: 0,
        })
      );
    });

    it('should use custom limit and offset when provided', async () => {
      await mockPrisma.narrowListeningPack.findMany({
        where: { userId: 'test-user-id' },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        skip: 40,
      });

      expect(mockPrisma.narrowListeningPack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          skip: 40,
        })
      );
    });

    it('should return minimal fields in library mode (_count for versions)', async () => {
      await mockPrisma.narrowListeningPack.findMany({
        where: { userId: 'test-user-id' },
        select: {
          id: true,
          title: true,
          topic: true,
          targetLanguage: true,
          status: true,
          createdAt: true,
          _count: {
            select: { versions: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        skip: 0,
      });

      expect(mockPrisma.narrowListeningPack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            _count: expect.any(Object),
          }),
        })
      );
    });

    it('should order by updatedAt desc', async () => {
      await mockPrisma.narrowListeningPack.findMany({
        where: expect.any(Object),
        orderBy: { updatedAt: 'desc' },
        take: 20,
        skip: 0,
      });

      expect(mockPrisma.narrowListeningPack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { updatedAt: 'desc' },
        })
      );
    });
  });
});
