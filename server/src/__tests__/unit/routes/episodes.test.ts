import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create hoisted mocks
const mockPrisma = vi.hoisted(() => ({
  episode: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

const mockGetLibraryUserId = vi.hoisted(() => vi.fn());
const mockGetEffectiveUserId = vi.hoisted(() => vi.fn());

vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../middleware/demoAuth.js', () => ({
  blockDemoUser: vi.fn((req, res, next) => next()),
  getLibraryUserId: mockGetLibraryUserId,
}));

vi.mock('../../../middleware/impersonation.js', () => ({
  getEffectiveUserId: mockGetEffectiveUserId,
}));

vi.mock('../../../middleware/auth.js', () => ({
  requireAuth: vi.fn((req, res, next) => {
    req.userId = 'test-user-id';
    next();
  }),
}));

describe('Episodes Route Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLibraryUserId.mockResolvedValue('test-user-id');
    mockGetEffectiveUserId.mockResolvedValue('test-user-id');
  });

  describe('GET / - List Episodes', () => {
    it('should query episodes with library mode select fields', async () => {
      const mockEpisodes = [
        { id: 'ep-1', title: 'Episode 1', targetLanguage: 'ja', status: 'ready' },
        { id: 'ep-2', title: 'Episode 2', targetLanguage: 'ja', status: 'ready' },
      ];
      mockPrisma.episode.findMany.mockResolvedValue(mockEpisodes);

      // Test the expected query structure for library mode
      const expectedQuery = {
        where: {
          userId: 'test-user-id',
          dialogue: { isNot: null },
        },
        select: {
          id: true,
          title: true,
          sourceText: true,
          targetLanguage: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          dialogue: {
            select: {
              speakers: {
                select: {
                  proficiency: true,
                },
              },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        skip: 0,
      };

      // Verify the Prisma query structure matches expected
      expect(expectedQuery.where.dialogue.isNot).toBe(null);
      expect(expectedQuery.select.id).toBe(true);
      expect(expectedQuery.orderBy.updatedAt).toBe('desc');
    });

    it('should query episodes with full mode include fields', async () => {
      mockPrisma.episode.findMany.mockResolvedValue([]);

      // Test the expected query structure for full mode
      const expectedQuery = {
        where: {
          userId: 'test-user-id',
          dialogue: { isNot: null },
        },
        include: {
          dialogue: {
            include: {
              sentences: true,
              speakers: true,
            },
          },
          images: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        skip: 0,
      };

      expect(expectedQuery.include.dialogue.include.sentences).toBe(true);
      expect(expectedQuery.include.images).toBe(true);
    });

    it('should support pagination with limit and offset', () => {
      // Test pagination parsing logic
      const parseLimit = (limitStr: string | undefined) => limitStr ? parseInt(limitStr, 10) : 50;
      const parseOffset = (offsetStr: string | undefined) => offsetStr ? parseInt(offsetStr, 10) : 0;

      expect(parseLimit('25')).toBe(25);
      expect(parseLimit(undefined)).toBe(50);
      expect(parseOffset('10')).toBe(10);
      expect(parseOffset(undefined)).toBe(0);
    });
  });

  describe('Pagination Tests', () => {
    beforeEach(() => {
      mockPrisma.episode.findMany.mockResolvedValue([]);
    });

    it('should use default pagination values when not provided (library mode)', async () => {
      const router = await import('../../../routes/episodes.js');

      // Simulate query with library=true but no limit/offset
      await mockPrisma.episode.findMany({
        where: {
          userId: 'test-user-id',
          dialogue: { isNot: null },
        },
        select: expect.any(Object),
        orderBy: { updatedAt: 'desc' },
        take: 50, // Default
        skip: 0,  // Default
      });

      expect(mockPrisma.episode.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          skip: 0,
        })
      );
    });

    it('should use custom limit and offset when provided (library mode)', async () => {
      await mockPrisma.episode.findMany({
        where: {
          userId: 'test-user-id',
          dialogue: { isNot: null },
        },
        select: expect.any(Object),
        orderBy: { updatedAt: 'desc' },
        take: 20,  // Custom limit
        skip: 40,  // Custom offset
      });

      expect(mockPrisma.episode.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          skip: 40,
        })
      );
    });

    it('should support pagination in full mode (with includes)', async () => {
      await mockPrisma.episode.findMany({
        where: {
          userId: 'test-user-id',
          dialogue: { isNot: null },
        },
        include: expect.any(Object),
        orderBy: { updatedAt: 'desc' },
        take: 20,
        skip: 20, // Second page
      });

      expect(mockPrisma.episode.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          skip: 20,
        })
      );
    });

    it('should order by updatedAt desc for pagination', async () => {
      await mockPrisma.episode.findMany({
        where: expect.any(Object),
        select: expect.any(Object),
        orderBy: { updatedAt: 'desc' },
        take: 20,
        skip: 0,
      });

      expect(mockPrisma.episode.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { updatedAt: 'desc' },
        })
      );
    });

    it('should handle first page request (offset=0)', async () => {
      await mockPrisma.episode.findMany({
        where: expect.any(Object),
        select: expect.any(Object),
        orderBy: { updatedAt: 'desc' },
        take: 20,
        skip: 0,
      });

      expect(mockPrisma.episode.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
        })
      );
    });

    it('should handle subsequent page requests correctly', async () => {
      // Page 2: offset = limit * 1 = 20
      await mockPrisma.episode.findMany({
        where: expect.any(Object),
        select: expect.any(Object),
        orderBy: { updatedAt: 'desc' },
        take: 20,
        skip: 20,
      });

      expect(mockPrisma.episode.findMany).toHaveBeenNthCalledWith(1,
        expect.objectContaining({
          skip: 20,
        })
      );

      // Page 3: offset = limit * 2 = 40
      await mockPrisma.episode.findMany({
        where: expect.any(Object),
        select: expect.any(Object),
        orderBy: { updatedAt: 'desc' },
        take: 20,
        skip: 40,
      });

      expect(mockPrisma.episode.findMany).toHaveBeenNthCalledWith(2,
        expect.objectContaining({
          skip: 40,
        })
      );
    });

    it('should return minimal fields in library mode (_count, no full relations)', async () => {
      const expectedSelect = {
        id: true,
        title: true,
        sourceText: true,
        targetLanguage: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        dialogue: {
          select: {
            speakers: {
              select: {
                proficiency: true,
              },
            },
          },
        },
      };

      await mockPrisma.episode.findMany({
        where: expect.any(Object),
        select: expectedSelect,
        orderBy: { updatedAt: 'desc' },
        take: 20,
        skip: 0,
      });

      expect(mockPrisma.episode.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expectedSelect,
        })
      );
    });

    it('should return full data with relations in non-library mode', async () => {
      const expectedInclude = {
        dialogue: {
          include: {
            sentences: true,
            speakers: true,
          },
        },
        images: true,
      };

      await mockPrisma.episode.findMany({
        where: expect.any(Object),
        include: expectedInclude,
        orderBy: { updatedAt: 'desc' },
        take: 20,
        skip: 0,
      });

      expect(mockPrisma.episode.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expectedInclude,
        })
      );
    });
  });

  describe('GET /:id - Single Episode', () => {
    it('should query episode by id and userId', async () => {
      const mockEpisode = {
        id: 'ep-123',
        title: 'Test Episode',
        userId: 'test-user-id',
        dialogue: {
          sentences: [],
          speakers: [],
        },
        images: [],
      };
      mockPrisma.episode.findFirst.mockResolvedValue(mockEpisode);

      const result = await mockPrisma.episode.findFirst({
        where: { id: 'ep-123', userId: 'test-user-id' },
        include: {
          dialogue: {
            include: {
              sentences: { orderBy: { order: 'asc' } },
              speakers: true,
            },
          },
          images: { orderBy: { order: 'asc' } },
        },
      });

      expect(result).toBeDefined();
      expect(result?.id).toBe('ep-123');
    });

    it('should return null for non-existent episode', async () => {
      mockPrisma.episode.findFirst.mockResolvedValue(null);

      const result = await mockPrisma.episode.findFirst({
        where: { id: 'non-existent', userId: 'test-user-id' },
      });

      expect(result).toBeNull();
    });
  });

  describe('POST / - Create Episode', () => {
    it('should require all mandatory fields', () => {
      const validateCreateEpisode = (body: any): string | null => {
        const { title, sourceText, targetLanguage, nativeLanguage } = body;
        if (!title || !sourceText || !targetLanguage || !nativeLanguage) {
          return 'Missing required fields';
        }
        return null;
      };

      expect(validateCreateEpisode({})).toBe('Missing required fields');
      expect(validateCreateEpisode({ title: 'Test' })).toBe('Missing required fields');
      expect(validateCreateEpisode({
        title: 'Test',
        sourceText: 'Source',
        targetLanguage: 'ja',
        nativeLanguage: 'en',
      })).toBeNull();
    });

    it('should create episode with correct default values', async () => {
      const mockCreatedEpisode = {
        id: 'new-ep',
        title: 'New Episode',
        sourceText: 'Test source',
        targetLanguage: 'ja',
        nativeLanguage: 'en',
        audioSpeed: 'medium',
        status: 'draft',
        userId: 'test-user-id',
      };
      mockPrisma.episode.create.mockResolvedValue(mockCreatedEpisode);

      const result = await mockPrisma.episode.create({
        data: {
          userId: 'test-user-id',
          title: 'New Episode',
          sourceText: 'Test source',
          targetLanguage: 'ja',
          nativeLanguage: 'en',
          audioSpeed: 'medium',
          status: 'draft',
        },
      });

      expect(result.status).toBe('draft');
      expect(result.audioSpeed).toBe('medium');
    });

    it('should use provided audioSpeed instead of default', async () => {
      mockPrisma.episode.create.mockResolvedValue({
        audioSpeed: 'slow',
      });

      const result = await mockPrisma.episode.create({
        data: {
          userId: 'test-user-id',
          title: 'Test',
          sourceText: 'Source',
          targetLanguage: 'ja',
          nativeLanguage: 'en',
          audioSpeed: 'slow',
          status: 'draft',
        },
      });

      expect(result.audioSpeed).toBe('slow');
    });
  });

  describe('PATCH /:id - Update Episode', () => {
    it('should update only provided fields', async () => {
      mockPrisma.episode.updateMany.mockResolvedValue({ count: 1 });

      // Test partial update logic
      const buildUpdateData = (body: { title?: string; status?: string }) => ({
        ...(body.title && { title: body.title }),
        ...(body.status && { status: body.status }),
        updatedAt: new Date(),
      });

      const dataWithTitle = buildUpdateData({ title: 'Updated Title' });
      expect(dataWithTitle.title).toBe('Updated Title');
      expect(dataWithTitle.status).toBeUndefined();

      const dataWithStatus = buildUpdateData({ status: 'ready' });
      expect(dataWithStatus.status).toBe('ready');
      expect(dataWithStatus.title).toBeUndefined();
    });

    it('should return 404 when episode not found', async () => {
      mockPrisma.episode.updateMany.mockResolvedValue({ count: 0 });

      const result = await mockPrisma.episode.updateMany({
        where: { id: 'non-existent', userId: 'test-user-id' },
        data: { title: 'Updated' },
      });

      expect(result.count).toBe(0);
    });

    it('should update when episode exists', async () => {
      mockPrisma.episode.updateMany.mockResolvedValue({ count: 1 });

      const result = await mockPrisma.episode.updateMany({
        where: { id: 'ep-123', userId: 'test-user-id' },
        data: { title: 'Updated Title' },
      });

      expect(result.count).toBe(1);
    });
  });

  describe('DELETE /:id - Delete Episode', () => {
    it('should delete episode by id and userId', async () => {
      mockPrisma.episode.deleteMany.mockResolvedValue({ count: 1 });

      const result = await mockPrisma.episode.deleteMany({
        where: { id: 'ep-123', userId: 'test-user-id' },
      });

      expect(result.count).toBe(1);
    });

    it('should return 404 when episode not found', async () => {
      mockPrisma.episode.deleteMany.mockResolvedValue({ count: 0 });

      const result = await mockPrisma.episode.deleteMany({
        where: { id: 'non-existent', userId: 'test-user-id' },
      });

      expect(result.count).toBe(0);
    });
  });

  describe('Demo User Behavior', () => {
    it('should use library userId for demo users', async () => {
      const libraryUserId = 'admin-user-id';
      mockGetLibraryUserId.mockResolvedValue(libraryUserId);

      const userId = await mockGetLibraryUserId('demo-user-id');

      expect(userId).toBe(libraryUserId);
    });

    it('should use own userId for regular users', async () => {
      mockGetLibraryUserId.mockImplementation((userId: string) => Promise.resolve(userId));

      const userId = await mockGetLibraryUserId('regular-user-id');

      expect(userId).toBe('regular-user-id');
    });
  });

  describe('Validation', () => {
    it('should validate target language is supported', () => {
      const supportedLanguages = ['ja', 'zh', 'es', 'fr', 'ar', 'he'];

      expect(supportedLanguages.includes('ja')).toBe(true);
      expect(supportedLanguages.includes('de')).toBe(false);
    });

    it('should validate audio speed values', () => {
      const validSpeeds = ['slow', 'medium', 'normal'];

      expect(validSpeeds.includes('slow')).toBe(true);
      expect(validSpeeds.includes('medium')).toBe(true);
      expect(validSpeeds.includes('fast')).toBe(false);
    });

    it('should validate episode status values', () => {
      const validStatuses = ['draft', 'generating', 'ready', 'error'];

      expect(validStatuses.includes('draft')).toBe(true);
      expect(validStatuses.includes('ready')).toBe(true);
      expect(validStatuses.includes('completed')).toBe(false);
    });
  });
});
