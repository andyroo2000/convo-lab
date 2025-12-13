import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthRequest } from '../../../middleware/auth.js';
import { getEffectiveUserId, getAuditLogs } from '../../../middleware/impersonation.js';
import { AppError } from '../../../middleware/errorHandler.js';

// Create hoisted mocks
const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  adminAuditLog: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}));

describe('Impersonation Middleware', () => {
  let mockReq: Partial<AuthRequest>;
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    mockReq = {
      userId: 'admin-123',
      query: {},
      ip: '192.168.1.1',
      socket: { remoteAddress: '192.168.1.1' },
      headers: { 'user-agent': 'Mozilla/5.0' },
      path: '/api/episodes',
      method: 'GET',
    } as Partial<AuthRequest>;
    vi.clearAllMocks();
  });

  describe('getEffectiveUserId', () => {
    describe('Without viewAs parameter', () => {
      it('should return requester userId when no viewAs param', async () => {
        mockReq.query = {};

        const result = await getEffectiveUserId(mockReq as AuthRequest);

        expect(result).toBe('admin-123');
        expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      });
    });

    describe('With viewAs parameter', () => {
      beforeEach(() => {
        mockReq.query = { viewAs: 'target-user-123' };
      });

      it('should throw 401 when userId is missing', async () => {
        mockReq.userId = undefined;

        await expect(getEffectiveUserId(mockReq as AuthRequest)).rejects.toThrow(AppError);
        await expect(getEffectiveUserId(mockReq as AuthRequest)).rejects.toThrow(
          'Authentication required'
        );

        try {
          await getEffectiveUserId(mockReq as AuthRequest);
        } catch (error) {
          expect((error as AppError).statusCode).toBe(401);
        }
      });

      it('should throw 403 when non-admin tries to use viewAs', async () => {
        mockPrisma.user.findUnique.mockResolvedValueOnce({ role: 'user' });

        await expect(getEffectiveUserId(mockReq as AuthRequest)).rejects.toThrow(AppError);
        await expect(getEffectiveUserId(mockReq as AuthRequest)).rejects.toThrow(
          'Unauthorized impersonation attempt'
        );

        try {
          await getEffectiveUserId(mockReq as AuthRequest);
        } catch (error) {
          expect((error as AppError).statusCode).toBe(403);
        }
      });

      it('should throw 404 when target user does not exist', async () => {
        mockPrisma.user.findUnique
          .mockResolvedValueOnce({ role: 'admin' }) // Admin check passes
          .mockResolvedValueOnce(null); // Target user not found

        try {
          await getEffectiveUserId(mockReq as AuthRequest);
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(AppError);
          expect((error as AppError).message).toBe('Target user not found');
          expect((error as AppError).statusCode).toBe(404);
        }
      });

      it('should return target userId when admin uses viewAs param', async () => {
        mockPrisma.user.findUnique
          .mockResolvedValueOnce({ role: 'admin' }) // Admin check
          .mockResolvedValueOnce({ id: 'target-user-123' }); // Target user exists

        mockPrisma.adminAuditLog.create.mockResolvedValue({
          id: 'audit-1',
          adminUserId: 'admin-123',
          action: 'impersonate_start',
          targetUserId: 'target-user-123',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          metadata: {},
          createdAt: new Date(),
        });

        const result = await getEffectiveUserId(mockReq as AuthRequest);

        expect(result).toBe('target-user-123');
      });

      it('should verify admin role before allowing impersonation', async () => {
        mockPrisma.user.findUnique
          .mockResolvedValueOnce({ role: 'admin' })
          .mockResolvedValueOnce({ id: 'target-user-123' });
        mockPrisma.adminAuditLog.create.mockResolvedValue({} as any);

        await getEffectiveUserId(mockReq as AuthRequest);

        expect(mockPrisma.user.findUnique).toHaveBeenNthCalledWith(1, {
          where: { id: 'admin-123' },
          select: { role: true },
        });
      });

      it('should verify target user exists', async () => {
        mockPrisma.user.findUnique
          .mockResolvedValueOnce({ role: 'admin' })
          .mockResolvedValueOnce({ id: 'target-user-123' });
        mockPrisma.adminAuditLog.create.mockResolvedValue({} as any);

        await getEffectiveUserId(mockReq as AuthRequest);

        expect(mockPrisma.user.findUnique).toHaveBeenNthCalledWith(2, {
          where: { id: 'target-user-123' },
          select: { id: true },
        });
      });
    });

    describe('Audit logging', () => {
      beforeEach(() => {
        mockReq.query = { viewAs: 'target-user-123' };
        mockPrisma.user.findUnique
          .mockResolvedValueOnce({ role: 'admin' })
          .mockResolvedValueOnce({ id: 'target-user-123' });
      });

      it('should create AdminAuditLog entry on successful impersonation', async () => {
        mockPrisma.adminAuditLog.create.mockResolvedValue({
          id: 'audit-1',
          adminUserId: 'admin-123',
          action: 'impersonate_start',
          targetUserId: 'target-user-123',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          metadata: {},
          createdAt: new Date(),
        });

        await getEffectiveUserId(mockReq as AuthRequest);

        expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith({
          data: {
            adminUserId: 'admin-123',
            action: 'impersonate_start',
            targetUserId: 'target-user-123',
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
            metadata: {
              path: '/api/episodes',
              method: 'GET',
              query: { viewAs: 'target-user-123' },
            },
          },
        });
      });

      it('should log IP address from req.ip', async () => {
        mockReq.ip = '10.0.0.1';
        mockPrisma.adminAuditLog.create.mockResolvedValue({} as any);

        await getEffectiveUserId(mockReq as AuthRequest);

        expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              ipAddress: '10.0.0.1',
            }),
          })
        );
      });

      it('should fallback to socket.remoteAddress if req.ip is undefined', async () => {
        mockReq.ip = undefined;
        mockReq.socket = { remoteAddress: '172.16.0.1' } as any;
        mockPrisma.adminAuditLog.create.mockResolvedValue({} as any);

        await getEffectiveUserId(mockReq as AuthRequest);

        expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              ipAddress: '172.16.0.1',
            }),
          })
        );
      });

      it('should use null for IP if neither source is available', async () => {
        mockReq.ip = undefined;
        mockReq.socket = { remoteAddress: undefined } as any;
        mockPrisma.adminAuditLog.create.mockResolvedValue({} as any);

        await getEffectiveUserId(mockReq as AuthRequest);

        expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              ipAddress: null,
            }),
          })
        );
      });

      it('should log user-agent from headers', async () => {
        mockReq.headers = { 'user-agent': 'Chrome/91.0' };
        mockPrisma.adminAuditLog.create.mockResolvedValue({} as any);

        await getEffectiveUserId(mockReq as AuthRequest);

        expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              userAgent: 'Chrome/91.0',
            }),
          })
        );
      });

      it('should use null for user-agent if not present', async () => {
        mockReq.headers = {};
        mockPrisma.adminAuditLog.create.mockResolvedValue({} as any);

        await getEffectiveUserId(mockReq as AuthRequest);

        expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              userAgent: null,
            }),
          })
        );
      });

      it('should include request metadata (path, method, query)', async () => {
        mockReq.path = '/api/courses';
        mockReq.method = 'POST';
        mockReq.query = { viewAs: 'target-user-123', someParam: 'value' };
        mockPrisma.adminAuditLog.create.mockResolvedValue({} as any);

        await getEffectiveUserId(mockReq as AuthRequest);

        expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              metadata: {
                path: '/api/courses',
                method: 'POST',
                query: { viewAs: 'target-user-123', someParam: 'value' },
              },
            }),
          })
        );
      });

      it('should not throw error if audit logging fails (graceful degradation)', async () => {
        mockPrisma.adminAuditLog.create.mockRejectedValue(new Error('Database error'));

        const result = await getEffectiveUserId(mockReq as AuthRequest);

        expect(result).toBe('target-user-123');
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to log impersonation event:',
          expect.any(Error)
        );
      });
    });
  });

  describe('getAuditLogs', () => {
    const mockLogs = [
      {
        id: 'audit-1',
        adminUserId: 'admin-123',
        action: 'impersonate_start',
        targetUserId: 'user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        metadata: {},
        createdAt: new Date('2025-12-10T10:00:00Z'),
      },
      {
        id: 'audit-2',
        adminUserId: 'admin-123',
        action: 'impersonate_end',
        targetUserId: 'user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        metadata: {},
        createdAt: new Date('2025-12-10T11:00:00Z'),
      },
    ];

    beforeEach(() => {
      mockPrisma.adminAuditLog.findMany.mockResolvedValue(mockLogs);
      mockPrisma.adminAuditLog.count.mockResolvedValue(2);
    });

    it('should return paginated audit logs', async () => {
      const result = await getAuditLogs({});

      expect(result).toEqual({
        logs: mockLogs,
        total: 2,
      });
    });

    it('should filter by adminUserId when provided', async () => {
      await getAuditLogs({ adminUserId: 'admin-123' });

      expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith({
        where: { adminUserId: 'admin-123' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should filter by action when provided', async () => {
      await getAuditLogs({ action: 'impersonate_start' });

      expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith({
        where: { action: 'impersonate_start' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should filter by date range (startDate and endDate)', async () => {
      const startDate = new Date('2025-12-01T00:00:00Z');
      const endDate = new Date('2025-12-31T23:59:59Z');

      await getAuditLogs({ startDate, endDate });

      expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should filter by startDate only', async () => {
      const startDate = new Date('2025-12-01T00:00:00Z');

      await getAuditLogs({ startDate });

      expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: startDate,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should filter by endDate only', async () => {
      const endDate = new Date('2025-12-31T23:59:59Z');

      await getAuditLogs({ endDate });

      expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            lte: endDate,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should respect limit parameter', async () => {
      await getAuditLogs({ limit: 10 });

      expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 0,
      });
    });

    it('should respect offset parameter', async () => {
      await getAuditLogs({ offset: 20 });

      expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 20,
      });
    });

    it('should use default limit of 50 when not provided', async () => {
      await getAuditLogs({});

      expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should use default offset of 0 when not provided', async () => {
      await getAuditLogs({});

      expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should order by createdAt desc', async () => {
      await getAuditLogs({});

      expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should return total count matching the where clause', async () => {
      await getAuditLogs({ adminUserId: 'admin-123' });

      expect(mockPrisma.adminAuditLog.count).toHaveBeenCalledWith({
        where: { adminUserId: 'admin-123' },
      });
    });

    it('should combine multiple filters', async () => {
      const startDate = new Date('2025-12-01T00:00:00Z');

      await getAuditLogs({
        adminUserId: 'admin-123',
        action: 'impersonate_start',
        startDate,
        limit: 25,
        offset: 10,
      });

      expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith({
        where: {
          adminUserId: 'admin-123',
          action: 'impersonate_start',
          createdAt: {
            gte: startDate,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
        skip: 10,
      });
    });
  });
});
