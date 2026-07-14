import { Router } from 'express';

import { prisma } from '../db/client.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

const ALLOWED_STUDY_READ_PATHS = [
  /^\/overview$/,
  /^\/settings$/,
  /^\/browser$/,
  /^\/new-queue$/,
  /^\/imports\/current$/,
  /^\/imports\/[^/]+$/,
];

function isAllowedStudyReadPath(pathname: string): boolean {
  return ALLOWED_STUDY_READ_PATHS.some((pattern) => pattern.test(pathname));
}

function getLearningOsConfig(): { apiUrl: string; apiToken: string } {
  const apiUrl = process.env.LEARNING_OS_API_URL?.trim();
  const apiToken = process.env.LEARNING_OS_API_TOKEN?.trim();

  if (!apiUrl || !apiToken) {
    throw new AppError('Learning OS Study API is enabled but not configured.', 503);
  }

  return {
    apiUrl: apiUrl.replace(/\/+$/, ''),
    apiToken,
  };
}

function appendQueryParams(target: URL, query: AuthRequest['query']) {
  Object.entries(query).forEach(([key, value]) => {
    if (typeof value === 'string') {
      target.searchParams.append(key, value);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === 'string') {
          target.searchParams.append(key, item);
        }
      });
    }
  });
}

router.get('/*', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) {
      throw new AppError('Authentication required', 401);
    }

    if (!isAllowedStudyReadPath(req.path)) {
      throw new AppError('Learning OS Study API route is not allowed.', 404);
    }

    const { apiUrl, apiToken } = getLearningOsConfig();
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const upstreamUrl = new URL(`${apiUrl}/api/study${req.path}`);
    appendQueryParams(upstreamUrl, req.query);

    const upstreamResponse = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiToken}`,
        'X-Convo-Lab-User-Id': user.id,
        'X-Convo-Lab-User-Email': user.email,
        'X-Convo-Lab-User-Role': user.role,
      },
    });

    const responseBody = await upstreamResponse.text();
    const contentType = upstreamResponse.headers.get('content-type');
    if (contentType) {
      res.type(contentType);
    }

    res.status(upstreamResponse.status).send(responseBody);
  } catch (error) {
    next(error);
  }
});

export default router;
