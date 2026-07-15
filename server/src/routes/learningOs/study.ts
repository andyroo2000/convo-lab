import { Router, type NextFunction, type Response } from 'express';
import { rateLimit as createExpressRateLimit } from 'express-rate-limit';

import { prisma } from '../../db/client.js';
import { requireAuth, type AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { getFeatureFlags, type FeatureFlagKey } from '../../middleware/featureFlags.js';
import { rateLimitStudyRoute } from '../../middleware/studyRateLimit.js';

import {
  adaptLearningOsStudyReadResponse,
  type LearningOsStudyReadFeature,
} from './studyReadAdapters.js';

const router = Router();
const LEARNING_OS_FETCH_TIMEOUT_MS = 10_000;
const learningOsStudyIpRateLimit = createExpressRateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
const learningOsStudyReadRateLimit = rateLimitStudyRoute({
  key: 'learning-os-read-proxy',
  max: 240,
  windowMs: 60 * 1000,
});
const learningOsStudyImportRateLimit = rateLimitStudyRoute({
  key: 'learning-os-import-proxy',
  max: 240,
  windowMs: 60 * 1000,
  onBackendError: 'fail-closed',
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
  responseFeature?: LearningOsStudyReadFeature;
  queryParams: ReadonlySet<string>;
  upstreamQueryAliases?: Readonly<Record<string, string>>;
}

const ALLOWED_STUDY_READ_ROUTES: StudyReadRoute[] = [
  {
    pattern: /^\/overview$/,
    featureFlag: 'studyApiOverview',
    responseFeature: 'overview',
    queryParams: new Set(['timeZone']),
    upstreamQueryAliases: { timeZone: 'time_zone' },
  },
  {
    pattern: /^\/settings$/,
    featureFlag: 'studyApiSettings',
    responseFeature: 'settings',
    queryParams: new Set(),
  },
  {
    pattern: /^\/browser$/,
    featureFlag: 'studyApiBrowser',
    responseFeature: 'browser',
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
    responseFeature: 'newQueue',
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

function getLearningOsConfig(): { apiUrl: string; apiToken: string; proxyUserEmail: string } {
  const apiUrl = process.env.LEARNING_OS_API_URL?.trim();
  const apiToken = process.env.LEARNING_OS_API_TOKEN?.trim();
  const proxyUserEmail = process.env.LEARNING_OS_PROXY_USER_EMAIL?.trim().toLowerCase();

  if (!apiUrl || !apiToken || !proxyUserEmail) {
    throw new AppError('Learning OS Study API is enabled but not configured.', 503);
  }

  return {
    apiUrl: apiUrl.replace(/\/+$/, ''),
    apiToken,
    proxyUserEmail,
  };
}

function appendQueryParams(target: URL, query: AuthRequest['query'], route: StudyReadRoute) {
  Object.entries(query).forEach(([key, value]) => {
    if (!route.queryParams.has(key)) {
      throw new AppError(`Query parameter "${key}" is not allowed for this Study API route.`, 400);
    }

    const upstreamKey = route.upstreamQueryAliases?.[key] ?? key;

    if (typeof value === 'string') {
      target.searchParams.append(upstreamKey, value);
      return;
    }

    throw new AppError(`Query parameter "${key}" must be provided exactly once as a string.`, 400);
  });
}

async function assertLearningOsStudyApiEnabled(featureFlag: StudyApiChildFlag) {
  const flags = await getFeatureFlags();

  if (flags?.studyApiEnabled === true && flags[featureFlag] === true) {
    return;
  }

  throw new AppError('Learning OS Study API route is not enabled.', 403);
}

function rateLimitLearningOsStudyRead(req: AuthRequest, res: Response, next: NextFunction) {
  const studyReadRoute = getStudyReadRoute(req.path);

  if (!studyReadRoute) {
    next();
    return;
  }

  if (studyReadRoute.featureFlag === 'studyApiImports') {
    learningOsStudyImportRateLimit(req, res, next);
    return;
  }

  learningOsStudyReadRateLimit(req, res, next);
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

function adaptStudyReadRouteResponse(route: StudyReadRoute, value: unknown): unknown {
  if (!route.responseFeature) {
    return value;
  }

  return adaptLearningOsStudyReadResponse(route.responseFeature, value);
}

router.get(
  '/*',
  learningOsStudyIpRateLimit,
  requireAuth,
  rateLimitLearningOsStudyRead,
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

      const { apiUrl, apiToken, proxyUserEmail } = getLearningOsConfig();
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { id: true, email: true, role: true },
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (user.email.trim().toLowerCase() !== proxyUserEmail) {
        throw new AppError('Learning OS Study API is not enabled for this account.', 403);
      }

      const upstreamUrl = new URL(`${apiUrl}/api/study${req.path}`);
      appendQueryParams(upstreamUrl, req.query, studyReadRoute);

      const upstreamResponse = await fetchLearningOsStudyRead(upstreamUrl, apiToken, user);

      if (!upstreamResponse.ok) {
        const statusCode = upstreamResponse.status >= 500 ? 502 : upstreamResponse.status;
        throw new AppError('Learning OS Study API request failed.', statusCode);
      }

      const responseBody = await upstreamResponse.text();
      let responseJson: unknown;
      try {
        responseJson = responseBody.length > 0 ? JSON.parse(responseBody) : null;
      } catch {
        throw new AppError('Learning OS Study API returned an invalid JSON response.', 502);
      }

      res
        .status(upstreamResponse.status)
        .json(adaptStudyReadRouteResponse(studyReadRoute, responseJson));
    } catch (error) {
      next(error);
    }
  }
);

export default router;
