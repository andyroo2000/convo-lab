import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { AppError } from './errorHandler.js';
import { prisma } from '../db/client.js';

/**
 * Get the effective user ID for a request.
 * If viewAs query parameter is present and requester is admin,
 * returns the target user ID. Otherwise returns the requester's ID.
 *
 * This enables admin impersonation for QA purposes.
 */
export async function getEffectiveUserId(req: AuthRequest): Promise<string> {
  const viewAsUserId = req.query.viewAs as string;

  if (viewAsUserId) {
    // Verify requester is authenticated
    if (!req.userId) {
      throw new AppError('Authentication required', 401);
    }

    // Verify requester is admin
    const admin = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true },
    });

    if (admin?.role !== 'admin') {
      throw new AppError('Unauthorized impersonation attempt', 403);
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: viewAsUserId },
      select: { id: true },
    });

    if (!targetUser) {
      throw new AppError('Target user not found', 404);
    }

    // Log impersonation event
    await logImpersonation(req.userId, viewAsUserId, req);

    return viewAsUserId;
  }

  // Default: return requester's own ID
  return req.userId!;
}

/**
 * Log an impersonation event to the audit log.
 */
async function logImpersonation(
  adminUserId: string,
  targetUserId: string,
  req: AuthRequest
): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminUserId,
        action: 'impersonate_start',
        targetUserId,
        ipAddress: req.ip || req.socket.remoteAddress || null,
        userAgent: req.headers['user-agent'] || null,
        metadata: {
          path: req.path,
          method: req.method,
          query: req.query,
        },
      },
    });
  } catch (error) {
    // Log but don't fail the request if audit logging fails
    console.error('Failed to log impersonation event:', error);
  }
}

/**
 * Get admin audit logs (for admin use).
 * Can filter by admin, action, or date range.
 */
export async function getAuditLogs(params: {
  adminUserId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const { adminUserId, action, startDate, endDate, limit = 50, offset = 0 } = params;

  const where: any = {};

  if (adminUserId) where.adminUserId = adminUserId;
  if (action) where.action = action;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const logs = await prisma.adminAuditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });

  const total = await prisma.adminAuditLog.count({ where });

  return { logs, total };
}
