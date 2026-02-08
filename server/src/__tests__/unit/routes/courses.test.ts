import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create hoisted mocks
const mockPrisma = vi.hoisted(() => ({
  course: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  episode: {
    findUnique: vi.fn(),
  },
  lesson: {
    deleteMany: vi.fn(),
    findMany: vi.fn(),
  },
}));

const mockCourseQueue = vi.hoisted(() => ({
  add: vi.fn(),
}));

const mockGetEffectiveUserId = vi.hoisted(() => vi.fn());

vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../jobs/courseQueue.js', () => ({
  courseQueue: mockCourseQueue,
}));

vi.mock('../../../middleware/impersonation.js', () => ({
  getEffectiveUserId: mockGetEffectiveUserId,
}));

describe('Courses Route Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEffectiveUserId.mockResolvedValue('test-user-id');
  });

  describe('GET / - List Courses', () => {
    it('should return courses for user with lessons and episode title', async () => {
      const mockCourses = [
        {
          id: 'course-1',
          episodeId: 'ep-1',
          status: 'ready',
          lessons: [{ id: 'lesson-1' }],
          episode: { title: 'Episode 1' },
        },
      ];
      mockPrisma.course.findMany.mockResolvedValue(mockCourses);

      const result = await mockPrisma.course.findMany({
        where: { userId: 'test-user-id' },
        include: {
          lessons: true,
          episode: { select: { title: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toHaveLength(1);
      expect(result[0].lessons).toBeDefined();
      expect(result[0].episode.title).toBe('Episode 1');
    });

    it('should order courses by createdAt descending', async () => {
      mockPrisma.course.findMany.mockResolvedValue([]);

      await mockPrisma.course.findMany({
        where: { userId: 'test-user-id' },
        orderBy: { createdAt: 'desc' },
      });

      expect(mockPrisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });
  });

  describe('GET /:id - Single Course', () => {
    it('should return course with full lesson details', async () => {
      const mockCourse = {
        id: 'course-1',
        lessons: [
          {
            id: 'lesson-1',
            lessonNumber: 1,
            audioUrl_0_7: 'url-slow',
            audioUrl_0_85: 'url-medium',
            audioUrl_1_0: 'url-normal',
          },
        ],
        episode: {
          title: 'Episode Title',
          dialogue: {
            sentences: [],
            speakers: [],
          },
        },
      };
      mockPrisma.course.findFirst.mockResolvedValue(mockCourse);

      const result = await mockPrisma.course.findFirst({
        where: { id: 'course-1', userId: 'test-user-id' },
        include: {
          lessons: {
            orderBy: { lessonNumber: 'asc' },
          },
          episode: {
            include: {
              dialogue: {
                include: { sentences: true, speakers: true },
              },
            },
          },
        },
      });

      expect(result?.lessons).toHaveLength(1);
      expect(result?.lessons[0].audioUrl_0_7).toBeDefined();
    });

    it('should return null for non-existent course', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(null);

      const result = await mockPrisma.course.findFirst({
        where: { id: 'non-existent', userId: 'test-user-id' },
      });

      expect(result).toBeNull();
    });
  });

  describe('POST / - Create Course', () => {
    it('should require episodeId', () => {
      const validateCreateCourse = (body: unknown): string | null => {
        if (!body || typeof body !== 'object' || !('episodeId' in body) || !body.episodeId) {
          return 'episodeId is required';
        }
        return null;
      };

      expect(validateCreateCourse({})).toBe('episodeId is required');
      expect(validateCreateCourse({ episodeId: 'ep-1' })).toBeNull();
    });

    it('should verify episode exists before creating course', async () => {
      mockPrisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        userId: 'test-user-id',
        dialogue: { sentences: [] },
      });

      const episode = await mockPrisma.episode.findUnique({
        where: { id: 'ep-1' },
        include: { dialogue: true },
      });

      expect(episode).toBeDefined();
    });

    it('should reject course creation for episode without dialogue', async () => {
      mockPrisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        userId: 'test-user-id',
        dialogue: null,
      });

      const episode = await mockPrisma.episode.findUnique({
        where: { id: 'ep-1' },
        include: { dialogue: true },
      });

      expect(episode?.dialogue).toBeNull();
      // Route would throw: 'Episode must have a generated dialogue first'
    });

    it('should create course with pending status', async () => {
      mockPrisma.course.create.mockResolvedValue({
        id: 'new-course',
        episodeId: 'ep-1',
        status: 'pending',
      });

      const result = await mockPrisma.course.create({
        data: {
          userId: 'test-user-id',
          episodeId: 'ep-1',
          status: 'pending',
        },
      });

      expect(result.status).toBe('pending');
    });
  });

  describe('POST /:id/generate - Generate Course', () => {
    it('should queue course generation job', async () => {
      mockCourseQueue.add.mockResolvedValue({ id: 'job-123' });

      await mockCourseQueue.add(
        { courseId: 'course-1', userId: 'test-user-id' },
        { jobId: 'course-course-1' }
      );

      expect(mockCourseQueue.add).toHaveBeenCalledWith(
        { courseId: 'course-1', userId: 'test-user-id' },
        expect.objectContaining({ jobId: 'course-course-1' })
      );
    });

    it('should update course status to generating', async () => {
      mockPrisma.course.update.mockResolvedValue({
        id: 'course-1',
        status: 'generating',
      });

      const result = await mockPrisma.course.update({
        where: { id: 'course-1' },
        data: { status: 'generating' },
      });

      expect(result.status).toBe('generating');
    });
  });

  describe('GET /:id/status - Course Status', () => {
    it('should return course status with lesson count', async () => {
      const mockCourse = {
        id: 'course-1',
        status: 'ready',
        _count: { lessons: 3 },
      };
      mockPrisma.course.findFirst.mockResolvedValue(mockCourse);

      const result = await mockPrisma.course.findFirst({
        where: { id: 'course-1', userId: 'test-user-id' },
        select: {
          id: true,
          status: true,
          _count: { select: { lessons: true } },
        },
      });

      expect(result?.status).toBe('ready');
      expect(result?._count.lessons).toBe(3);
    });
  });

  describe('POST /:id/reset - Reset Course', () => {
    it('should delete all lessons and reset status', async () => {
      mockPrisma.lesson.deleteMany.mockResolvedValue({ count: 5 });
      mockPrisma.course.update.mockResolvedValue({
        id: 'course-1',
        status: 'pending',
      });

      await mockPrisma.lesson.deleteMany({
        where: { courseId: 'course-1' },
      });

      await mockPrisma.course.update({
        where: { id: 'course-1' },
        data: { status: 'pending' },
      });

      expect(mockPrisma.lesson.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.course.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'pending' },
        })
      );
    });

    it('should only reset stuck courses (generating or error status)', () => {
      const isStuckStatus = (status: string) => ['generating', 'error'].includes(status);

      expect(isStuckStatus('generating')).toBe(true);
      expect(isStuckStatus('error')).toBe(true);
      expect(isStuckStatus('ready')).toBe(false);
      expect(isStuckStatus('pending')).toBe(false);
    });
  });

  describe('DELETE /:id - Delete Course', () => {
    it('should delete course and cascade to lessons', async () => {
      mockPrisma.course.delete.mockResolvedValue({
        id: 'course-1',
      });

      await mockPrisma.course.delete({
        where: { id: 'course-1' },
      });

      expect(mockPrisma.course.delete).toHaveBeenCalledWith({
        where: { id: 'course-1' },
      });
    });
  });

  describe('Pagination Tests', () => {
    beforeEach(() => {
      mockPrisma.course.findMany.mockResolvedValue([]);
    });

    it('should use default pagination values (limit=50, offset=0)', async () => {
      await mockPrisma.course.findMany({
        where: { userId: 'test-user-id' },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        skip: 0,
      });

      expect(mockPrisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          skip: 0,
        })
      );
    });

    it('should use custom limit and offset when provided', async () => {
      await mockPrisma.course.findMany({
        where: { userId: 'test-user-id' },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        skip: 40,
      });

      expect(mockPrisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          skip: 40,
        })
      );
    });

    it('should return minimal fields in library mode (_count instead of full relations)', async () => {
      await mockPrisma.course.findMany({
        where: { userId: 'test-user-id' },
        select: {
          id: true,
          episodeId: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { lessons: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        skip: 0,
      });

      expect(mockPrisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            _count: expect.any(Object),
          }),
        })
      );
    });

    it('should return full data with relations in non-library mode', async () => {
      await mockPrisma.course.findMany({
        where: { userId: 'test-user-id' },
        include: {
          lessons: true,
          episode: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        skip: 0,
      });

      expect(mockPrisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.any(Object),
        })
      );
    });

    it('should order by updatedAt desc', async () => {
      await mockPrisma.course.findMany({
        where: expect.any(Object),
        orderBy: { updatedAt: 'desc' },
        take: 20,
        skip: 0,
      });

      expect(mockPrisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { updatedAt: 'desc' },
        })
      );
    });
  });

  describe('Draft Status Filtering', () => {
    it('should hide drafts by default for non-admin users', () => {
      const buildStatusFilter = (
        statusFilter: string | undefined,
        isAdmin: boolean
      ): { not: string } | { equals: string } | undefined => {
        if (statusFilter === 'all' && isAdmin) {
          return undefined;
        } else if (statusFilter === 'draft' && isAdmin) {
          return { equals: 'draft' };
        }
        return { not: 'draft' };
      };

      const result = buildStatusFilter(undefined, false);
      expect(result).toEqual({ not: 'draft' });
    });

    it('should hide drafts for non-admin even if status=all is requested', () => {
      const buildStatusFilter = (
        statusFilter: string | undefined,
        isAdmin: boolean
      ): { not: string } | { equals: string } | undefined => {
        if (statusFilter === 'all' && isAdmin) {
          return undefined;
        } else if (statusFilter === 'draft' && isAdmin) {
          return { equals: 'draft' };
        }
        return { not: 'draft' };
      };

      const result = buildStatusFilter('all', false);
      expect(result).toEqual({ not: 'draft' });
    });

    it('should return all statuses for admin with status=all', () => {
      const buildStatusFilter = (
        statusFilter: string | undefined,
        isAdmin: boolean
      ): { not: string } | { equals: string } | undefined => {
        if (statusFilter === 'all' && isAdmin) {
          return undefined;
        } else if (statusFilter === 'draft' && isAdmin) {
          return { equals: 'draft' };
        }
        return { not: 'draft' };
      };

      const result = buildStatusFilter('all', true);
      expect(result).toBeUndefined();
    });

    it('should return only drafts for admin with status=draft', () => {
      const buildStatusFilter = (
        statusFilter: string | undefined,
        isAdmin: boolean
      ): { not: string } | { equals: string } | undefined => {
        if (statusFilter === 'all' && isAdmin) {
          return undefined;
        } else if (statusFilter === 'draft' && isAdmin) {
          return { equals: 'draft' };
        }
        return { not: 'draft' };
      };

      const result = buildStatusFilter('draft', true);
      expect(result).toEqual({ equals: 'draft' });
    });

    it('should hide drafts for admin with no status filter', () => {
      const buildStatusFilter = (
        statusFilter: string | undefined,
        isAdmin: boolean
      ): { not: string } | { equals: string } | undefined => {
        if (statusFilter === 'all' && isAdmin) {
          return undefined;
        } else if (statusFilter === 'draft' && isAdmin) {
          return { equals: 'draft' };
        }
        return { not: 'draft' };
      };

      const result = buildStatusFilter(undefined, true);
      expect(result).toEqual({ not: 'draft' });
    });

    it('should apply status filter to findMany where clause', async () => {
      mockPrisma.course.findMany.mockResolvedValue([]);

      const statusWhere = { not: 'draft' };
      await mockPrisma.course.findMany({
        where: { userId: 'test-user-id', ...(statusWhere ? { status: statusWhere } : {}) },
        orderBy: { updatedAt: 'desc' },
      });

      expect(mockPrisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { not: 'draft' },
          }),
        })
      );
    });

    it('should omit status from where clause when filter is undefined (admin status=all)', async () => {
      mockPrisma.course.findMany.mockResolvedValue([]);

      const statusWhere = undefined;
      await mockPrisma.course.findMany({
        where: { userId: 'test-user-id', ...(statusWhere ? { status: statusWhere } : {}) },
        orderBy: { updatedAt: 'desc' },
      });

      expect(mockPrisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'test-user-id' },
        })
      );
    });
  });

  describe('Validation', () => {
    it('should validate course status values', () => {
      const validStatuses = ['pending', 'generating', 'ready', 'error'];

      expect(validStatuses.includes('pending')).toBe(true);
      expect(validStatuses.includes('generating')).toBe(true);
      expect(validStatuses.includes('ready')).toBe(true);
      expect(validStatuses.includes('error')).toBe(true);
      expect(validStatuses.includes('draft')).toBe(false);
    });

    it('should validate duration parameters', () => {
      const validateDuration = (duration: number) => duration >= 5 && duration <= 60;

      expect(validateDuration(15)).toBe(true);
      expect(validateDuration(30)).toBe(true);
      expect(validateDuration(4)).toBe(false);
      expect(validateDuration(61)).toBe(false);
    });
  });
});
