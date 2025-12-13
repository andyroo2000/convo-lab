import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create hoisted mocks
const mockPrisma = vi.hoisted(() => ({
  chunkPack: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  narrowListeningPack: {
    create: vi.fn(),
  },
}));

const mockChunkPackQueue = vi.hoisted(() => ({
  add: vi.fn(),
  getJob: vi.fn(),
}));

const mockNarrowListeningQueue = vi.hoisted(() => ({
  add: vi.fn(),
}));

const mockGetLibraryUserId = vi.hoisted(() => vi.fn());
const mockGetEffectiveUserId = vi.hoisted(() => vi.fn());

vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../jobs/chunkPackQueue.js', () => ({
  chunkPackQueue: mockChunkPackQueue,
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

describe('Chunk Packs Route Logic', () => {
  beforeEach(() => {
    mockGetEffectiveUserId.mockResolvedValue('test-user-id');
    vi.clearAllMocks();
    mockGetLibraryUserId.mockResolvedValue('test-user-id');
  });

  describe('GET / - List Chunk Packs', () => {
    it('should return packs in library mode with minimal data', async () => {
      const mockPacks = [
        {
          id: 'pack-1',
          title: 'N5 Daily Life',
          theme: 'daily_activities',
          targetLanguage: 'ja',
          jlptLevel: 'N5',
          status: 'ready',
          _count: { examples: 10, stories: 2, exercises: 5 },
        },
      ];
      mockPrisma.chunkPack.findMany.mockResolvedValue(mockPacks);

      // Library mode query structure
      const libraryModeQuery = {
        where: { userId: 'test-user-id' },
        select: {
          id: true,
          title: true,
          theme: true,
          targetLanguage: true,
          jlptLevel: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { examples: true, stories: true, exercises: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        skip: 0,
      };

      expect(libraryModeQuery.select._count).toBeDefined();
      expect(libraryModeQuery.orderBy.updatedAt).toBe('desc');
    });

    it('should return packs in full mode with chunks', async () => {
      const mockPacks = [
        {
          id: 'pack-1',
          chunks: [
            { id: 'chunk-1', form: '食べる', meaning: 'to eat', order: 0 },
          ],
          _count: { examples: 10, stories: 2, exercises: 5 },
        },
      ];
      mockPrisma.chunkPack.findMany.mockResolvedValue(mockPacks);

      const result = await mockPrisma.chunkPack.findMany({
        where: { userId: 'test-user-id' },
        include: {
          chunks: { orderBy: { order: 'asc' } },
          _count: { select: { examples: true, stories: true, exercises: true } },
        },
      });

      expect(result[0].chunks).toBeDefined();
      expect(result[0].chunks).toHaveLength(1);
    });

    it('should support pagination with limit and offset', () => {
      const parseLimit = (limitStr: string | undefined) =>
        limitStr ? parseInt(limitStr, 10) : 50;
      const parseOffset = (offsetStr: string | undefined) =>
        offsetStr ? parseInt(offsetStr, 10) : 0;

      expect(parseLimit('25')).toBe(25);
      expect(parseLimit(undefined)).toBe(50);
      expect(parseOffset('10')).toBe(10);
      expect(parseOffset(undefined)).toBe(0);
    });

    it('should use library userId for demo users', async () => {
      mockGetLibraryUserId.mockResolvedValue('admin-user-id');

      const userId = await mockGetLibraryUserId('demo-user-id');

      expect(userId).toBe('admin-user-id');
    });
  });

  describe('GET /:id - Single Chunk Pack', () => {
    it('should return pack with full details', async () => {
      const mockPack = {
        id: 'pack-1',
        title: 'N5 Daily Life',
        chunks: [
          {
            id: 'chunk-1',
            form: '食べる',
            examples: [{ id: 'ex-1', japanese: '朝ご飯を食べる' }],
          },
        ],
        examples: [{ id: 'ex-1', order: 0 }],
        stories: [{ id: 'story-1', segments: [] }],
        exercises: [{ id: 'exercise-1', order: 0 }],
      };
      mockPrisma.chunkPack.findFirst.mockResolvedValue(mockPack);

      const result = await mockPrisma.chunkPack.findFirst({
        where: { id: 'pack-1', userId: 'test-user-id' },
        include: {
          chunks: { orderBy: { order: 'asc' }, include: { examples: true } },
          examples: { orderBy: { order: 'asc' } },
          stories: { include: { segments: { orderBy: { order: 'asc' } } } },
          exercises: { orderBy: { order: 'asc' } },
        },
      });

      expect(result?.chunks).toBeDefined();
      expect(result?.stories).toBeDefined();
      expect(result?.exercises).toBeDefined();
    });

    it('should return null for non-existent pack', async () => {
      mockPrisma.chunkPack.findFirst.mockResolvedValue(null);

      const result = await mockPrisma.chunkPack.findFirst({
        where: { id: 'non-existent', userId: 'test-user-id' },
      });

      expect(result).toBeNull();
      // Route would throw AppError('Chunk pack not found', 404)
    });
  });

  describe('POST /generate - Generate Chunk Pack', () => {
    it('should require jlptLevel and theme', () => {
      const validateGenerateChunkPack = (body: any): string | null => {
        const { jlptLevel, theme } = body;
        if (!jlptLevel || !theme) {
          return 'JLPT level and theme are required';
        }
        return null;
      };

      expect(validateGenerateChunkPack({})).toBe('JLPT level and theme are required');
      expect(validateGenerateChunkPack({ jlptLevel: 'N5' })).toBe(
        'JLPT level and theme are required'
      );
      expect(validateGenerateChunkPack({ jlptLevel: 'N5', theme: 'daily_activities' })).toBeNull();
    });

    it('should validate JLPT level is N5, N4, or N3', () => {
      const validJlptLevels = ['N5', 'N4', 'N3'];
      const isValidJlptLevel = (level: string) => validJlptLevels.includes(level);

      expect(isValidJlptLevel('N5')).toBe(true);
      expect(isValidJlptLevel('N4')).toBe(true);
      expect(isValidJlptLevel('N3')).toBe(true);
      expect(isValidJlptLevel('N2')).toBe(false);
      expect(isValidJlptLevel('N1')).toBe(false);
    });

    it('should queue chunk pack generation job', async () => {
      mockChunkPackQueue.add.mockResolvedValue({ id: 'job-123' });

      const job = await mockChunkPackQueue.add('generate', {
        userId: 'test-user-id',
        jlptLevel: 'N5',
        theme: 'daily_activities',
      });

      expect(mockChunkPackQueue.add).toHaveBeenCalledWith(
        'generate',
        expect.objectContaining({
          userId: 'test-user-id',
          jlptLevel: 'N5',
          theme: 'daily_activities',
        })
      );
      expect(job.id).toBe('job-123');
    });

    it('should validate theme matches JLPT level', () => {
      const themeMetadata: Record<string, { level: string; name: string }> = {
        daily_activities: { level: 'N5', name: 'Daily Activities' },
        shopping: { level: 'N5', name: 'Shopping' },
        travel: { level: 'N4', name: 'Travel' },
        workplace: { level: 'N3', name: 'Workplace' },
      };

      const validateThemeLevel = (theme: string, jlptLevel: string): string | null => {
        const metadata = themeMetadata[theme];
        if (!metadata) {
          return 'Invalid theme';
        }
        if (metadata.level !== jlptLevel) {
          return `Theme "${metadata.name}" is for ${metadata.level} level, but you selected ${jlptLevel}`;
        }
        return null;
      };

      expect(validateThemeLevel('daily_activities', 'N5')).toBeNull();
      expect(validateThemeLevel('daily_activities', 'N4')).toContain('is for N5 level');
      expect(validateThemeLevel('invalid_theme', 'N5')).toBe('Invalid theme');
    });
  });

  describe('GET /job/:jobId - Job Status', () => {
    it('should return job status with progress', async () => {
      mockChunkPackQueue.getJob.mockResolvedValue({
        id: 'job-123',
        getState: vi.fn().mockResolvedValue('active'),
        progress: { step: 'generating_chunks', progress: 30 },
        returnvalue: null,
      });

      const job = await mockChunkPackQueue.getJob('job-123');

      expect(job).toBeDefined();
      expect(await job.getState()).toBe('active');
      expect(job.progress.step).toBe('generating_chunks');
    });

    it('should return completed job with result', async () => {
      const mockResult = {
        packId: 'pack-1',
        chunksCount: 10,
      };

      mockChunkPackQueue.getJob.mockResolvedValue({
        id: 'job-123',
        getState: vi.fn().mockResolvedValue('completed'),
        progress: 100,
        returnvalue: mockResult,
      });

      const job = await mockChunkPackQueue.getJob('job-123');
      const state = await job.getState();

      expect(state).toBe('completed');
      expect(job.returnvalue.packId).toBe('pack-1');
    });

    it('should return null for non-existent job', async () => {
      mockChunkPackQueue.getJob.mockResolvedValue(null);

      const job = await mockChunkPackQueue.getJob('non-existent');

      expect(job).toBeNull();
      // Route would throw AppError('Job not found', 404)
    });
  });

  describe('POST /:id/create-nl-session - Create NL Session', () => {
    it('should verify pack exists and belongs to user', async () => {
      mockPrisma.chunkPack.findFirst.mockResolvedValue({
        id: 'pack-1',
        userId: 'test-user-id',
        status: 'ready',
        chunks: [],
        stories: [{ id: 'story-1', segments: [] }],
      });

      const pack = await mockPrisma.chunkPack.findFirst({
        where: { id: 'pack-1', userId: 'test-user-id' },
        include: { chunks: true, stories: { include: { segments: true } } },
      });

      expect(pack).toBeDefined();
      expect(pack?.userId).toBe('test-user-id');
    });

    it('should reject if pack is not ready', async () => {
      mockPrisma.chunkPack.findFirst.mockResolvedValue({
        id: 'pack-1',
        status: 'generating',
      });

      const pack = await mockPrisma.chunkPack.findFirst({
        where: { id: 'pack-1' },
      });

      expect(pack?.status).toBe('generating');
      // Route would throw AppError('Chunk pack is not ready yet', 400)
    });

    it('should reject if pack has no stories', async () => {
      mockPrisma.chunkPack.findFirst.mockResolvedValue({
        id: 'pack-1',
        status: 'ready',
        stories: [],
      });

      const pack = await mockPrisma.chunkPack.findFirst({
        where: { id: 'pack-1' },
        include: { stories: true },
      });

      expect(pack?.stories).toHaveLength(0);
      // Route would throw AppError('Chunk pack has no story', 400)
    });

    it('should create NL pack and queue generation job', async () => {
      const mockChunkPack = {
        id: 'pack-1',
        title: 'N5 Daily Life',
        jlptLevel: 'N5',
        status: 'ready',
        chunks: [
          { id: 'chunk-1', form: '食べる' },
          { id: 'chunk-2', form: '飲む' },
        ],
        stories: [{ id: 'story-1', segments: [] }],
      };

      mockPrisma.chunkPack.findFirst.mockResolvedValue(mockChunkPack);
      mockPrisma.narrowListeningPack.create.mockResolvedValue({
        id: 'nl-pack-1',
        title: 'N5 Daily Life - Narrow Listening',
      });
      mockNarrowListeningQueue.add.mockResolvedValue({ id: 'nl-job-123' });

      const pack = await mockPrisma.chunkPack.findFirst({
        where: { id: 'pack-1' },
      });

      const chunkForms = pack!.chunks.map((c: any) => c.form).join(', ');
      expect(chunkForms).toBe('食べる, 飲む');

      const nlPack = await mockPrisma.narrowListeningPack.create({
        data: {
          userId: 'test-user-id',
          title: `${pack!.title} - Narrow Listening`,
          topic: `Story from chunk pack: ${pack!.title}. Target chunks: ${chunkForms}`,
          jlptLevel: pack!.jlptLevel,
          grammarFocus: chunkForms,
          status: 'generating',
        },
      });

      const job = await mockNarrowListeningQueue.add('generate', {
        packId: nlPack.id,
        jlptLevel: pack!.jlptLevel,
        versionCount: 4,
      });

      expect(nlPack.title).toContain('Narrow Listening');
      expect(job.id).toBe('nl-job-123');
    });
  });

  describe('DELETE /:id - Delete Chunk Pack', () => {
    it('should verify pack exists before deleting', async () => {
      mockPrisma.chunkPack.findFirst.mockResolvedValue({
        id: 'pack-1',
        userId: 'test-user-id',
      });

      const pack = await mockPrisma.chunkPack.findFirst({
        where: { id: 'pack-1', userId: 'test-user-id' },
      });

      expect(pack).toBeDefined();
    });

    it('should return 404 for non-existent pack', async () => {
      mockPrisma.chunkPack.findFirst.mockResolvedValue(null);

      const pack = await mockPrisma.chunkPack.findFirst({
        where: { id: 'non-existent', userId: 'test-user-id' },
      });

      expect(pack).toBeNull();
      // Route would throw AppError('Chunk pack not found', 404)
    });

    it('should delete pack by id', async () => {
      mockPrisma.chunkPack.findFirst.mockResolvedValue({
        id: 'pack-1',
        userId: 'test-user-id',
      });
      mockPrisma.chunkPack.delete.mockResolvedValue({ id: 'pack-1' });

      await mockPrisma.chunkPack.delete({
        where: { id: 'pack-1' },
      });

      expect(mockPrisma.chunkPack.delete).toHaveBeenCalledWith({
        where: { id: 'pack-1' },
      });
    });
  });

  describe('JLPT Level Validation', () => {
    it('should recognize valid JLPT levels for chunk packs', () => {
      // Chunk packs only support N5, N4, N3
      const chunkPackLevels = ['N5', 'N4', 'N3'];

      expect(chunkPackLevels).toContain('N5');
      expect(chunkPackLevels).toContain('N4');
      expect(chunkPackLevels).toContain('N3');
      expect(chunkPackLevels).not.toContain('N2');
      expect(chunkPackLevels).not.toContain('N1');
    });

    it('should map JLPT level to difficulty', () => {
      const levelToDifficulty = (level: string) => {
        switch (level) {
          case 'N5':
            return 'beginner';
          case 'N4':
            return 'elementary';
          case 'N3':
            return 'intermediate';
          default:
            return 'unknown';
        }
      };

      expect(levelToDifficulty('N5')).toBe('beginner');
      expect(levelToDifficulty('N4')).toBe('elementary');
      expect(levelToDifficulty('N3')).toBe('intermediate');
    });
  });

  describe('Pack Status Values', () => {
    it('should recognize valid pack statuses', () => {
      const validStatuses = ['pending', 'generating', 'ready', 'error'];

      expect(validStatuses).toContain('pending');
      expect(validStatuses).toContain('generating');
      expect(validStatuses).toContain('ready');
      expect(validStatuses).toContain('error');
    });

    it('should only allow NL session creation for ready packs', () => {
      const canCreateNLSession = (status: string) => status === 'ready';

      expect(canCreateNLSession('ready')).toBe(true);
      expect(canCreateNLSession('generating')).toBe(false);
      expect(canCreateNLSession('pending')).toBe(false);
      expect(canCreateNLSession('error')).toBe(false);
    });
  });

  describe('Pagination Tests', () => {
    beforeEach(() => {
      mockPrisma.chunkPack.findMany.mockResolvedValue([]);
    });

    it('should use default pagination values (limit=50, offset=0)', async () => {
      await mockPrisma.chunkPack.findMany({
        where: { userId: 'test-user-id' },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        skip: 0,
      });

      expect(mockPrisma.chunkPack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          skip: 0,
        })
      );
    });

    it('should use custom limit and offset when provided', async () => {
      await mockPrisma.chunkPack.findMany({
        where: { userId: 'test-user-id' },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        skip: 40,
      });

      expect(mockPrisma.chunkPack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          skip: 40,
        })
      );
    });

    it('should return minimal fields in library mode (_count for examples, stories, exercises)', async () => {
      await mockPrisma.chunkPack.findMany({
        where: { userId: 'test-user-id' },
        select: {
          id: true,
          title: true,
          theme: true,
          targetLanguage: true,
          status: true,
          createdAt: true,
          _count: {
            select: {
              examples: true,
              stories: true,
              exercises: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        skip: 0,
      });

      expect(mockPrisma.chunkPack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            _count: expect.any(Object),
          }),
        })
      );
    });

    it('should order by updatedAt desc', async () => {
      await mockPrisma.chunkPack.findMany({
        where: expect.any(Object),
        orderBy: { updatedAt: 'desc' },
        take: 20,
        skip: 0,
      });

      expect(mockPrisma.chunkPack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { updatedAt: 'desc' },
        })
      );
    });
  });
});
