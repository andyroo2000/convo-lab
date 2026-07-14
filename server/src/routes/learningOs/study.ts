import { Router } from 'express';
import { rateLimit as createExpressRateLimit } from 'express-rate-limit';

import { prisma } from '../../db/client.js';
import { requireAuth, type AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { getFeatureFlags, type FeatureFlagKey } from '../../middleware/featureFlags.js';
import { rateLimitStudyRoute } from '../../middleware/studyRateLimit.js';

const router = Router();
const LEARNING_OS_FETCH_TIMEOUT_MS = 10_000;
const learningOsStudyIpRateLimit = createExpressRateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

type StudyApiChildFlag = Extract<
  FeatureFlagKey,
  | 'studyApiOverview'
  | 'studyApiSettings'
  | 'studyApiBrowser'
  | 'studyApiNewQueue'
  | 'studyApiImports'
>;

interface StudyReadRoute {
  pattern: RegExp;
  featureFlag: StudyApiChildFlag;
  queryParams: ReadonlySet<string>;
}

const ALLOWED_STUDY_READ_ROUTES: StudyReadRoute[] = [
  {
    pattern: /^\/overview$/,
    featureFlag: 'studyApiOverview',
    queryParams: new Set(['timeZone']),
  },
  {
    pattern: /^\/settings$/,
    featureFlag: 'studyApiSettings',
    queryParams: new Set(),
  },
  {
    pattern: /^\/browser$/,
    featureFlag: 'studyApiBrowser',
    queryParams: new Set([
      'q',
      'noteType',
      'cardType',
      'queueState',
      'sortField',
      'sortDirection',
      'cursor',
      'limit',
    ]),
  },
  {
    pattern: /^\/new-queue$/,
    featureFlag: 'studyApiNewQueue',
    queryParams: new Set(['cursor', 'limit', 'q']),
  },
  {
    pattern: /^\/imports\/current$/,
    featureFlag: 'studyApiImports',
    queryParams: new Set(),
  },
  {
    pattern: /^\/imports\/[A-Za-z0-9_-]+$/,
    featureFlag: 'studyApiImports',
    queryParams: new Set(),
  },
];

function getStudyReadRoute(pathname: string): StudyReadRoute | null {
  return ALLOWED_STUDY_READ_ROUTES.find((route) => route.pattern.test(pathname)) ?? null;
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

function appendQueryParams(
  target: URL,
  query: AuthRequest['query'],
  allowedParams: ReadonlySet<string>
) {
  Object.entries(query).forEach(([key, value]) => {
    if (!allowedParams.has(key)) {
      throw new AppError(`Query parameter "${key}" is not allowed for this Study API route.`, 400);
    }

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

async function assertLearningOsStudyApiEnabled(featureFlag: StudyApiChildFlag) {
  const flags = await getFeatureFlags();

  if (flags?.studyApiEnabled === true && flags[featureFlag] === true) {
    return;
  }

  throw new AppError('Learning OS Study API route is not enabled.', 403);
}

async function fetchLearningOsStudyRead(upstreamUrl: URL, apiToken: string, user: UserIdentity) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LEARNING_OS_FETCH_TIMEOUT_MS);

  try {
    return await fetch(upstreamUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiToken}`,
        'X-Convo-Lab-User-Id': user.id,
        'X-Convo-Lab-User-Email': user.email,
        'X-Convo-Lab-User-Role': user.role,
      },
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new AppError('Learning OS Study API request timed out.', 504);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

interface UserIdentity {
  id: string;
  email: string;
  role: string;
}

router.get(
  '/*',
  learningOsStudyIpRateLimit,
  requireAuth,
  rateLimitStudyRoute({
    key: 'learning-os-read-proxy',
    max: 240,
    windowMs: 60 * 1000,
    onBackendError: 'fail-closed',
  }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new AppError('Authentication required', 401);
      }

      const studyReadRoute = getStudyReadRoute(req.path);
      if (!studyReadRoute) {
        throw new AppError('Learning OS Study API route is not allowed.', 404);
      }

      await assertLearningOsStudyApiEnabled(studyReadRoute.featureFlag);

      const { apiUrl, apiToken } = getLearningOsConfig();
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { id: true, email: true, role: true },
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      const upstreamUrl = new URL(`${apiUrl}/api/study${req.path}`);
      appendQueryParams(upstreamUrl, req.query, studyReadRoute.queryParams);

      const upstreamResponse = await fetchLearningOsStudyRead(upstreamUrl, apiToken, user);

      if (!upstreamResponse.ok) {
        const statusCode = upstreamResponse.status >= 500 ? 502 : upstreamResponse.status;
        throw new AppError('Learning OS Study API request failed.', statusCode);
      }

      const responseBody = await upstreamResponse.text();
      const contentType = upstreamResponse.headers.get('content-type');
      if (contentType) {
        res.type(contentType);
      }

      res.status(upstreamResponse.status).send(responseBody);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
