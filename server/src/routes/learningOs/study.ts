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
const MAX_NEW_QUEUE_REORDER_SIZE = 500;
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/i;

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
const learningOsSettingsWriteRateLimit = rateLimitStudyRoute({
  key: 'learning-os-settings-write-proxy',
  max: 60,
  windowMs: 60 * 1000,
  onBackendError: 'fail-closed',
});
const learningOsNewQueueWriteRateLimit = rateLimitStudyRoute({
  key: 'learning-os-new-queue-write-proxy',
  max: 60,
  windowMs: 60 * 1000,
  onBackendError: 'fail-closed',
});

type StudyApiChildFlag = Extract<
  FeatureFlagKey,
  | 'studyApiOverview'
  | 'studyApiSettings'
  | 'studyApiBrowser'
  | 'studyApiBrowserDetail'
  | 'studyApiNewQueue'
  | 'studyApiImports'
  | 'studyApiSettingsWrite'
  | 'studyApiNewQueueWrite'
>;

type StudyProxyMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
type StudyWriteFeature = 'settingsWrite' | 'newQueueWrite';
type StudyWriteBody = 'knownKanjiManual' | 'newQueue' | 'settings' | 'wanikaniConnection';

interface StudyProxyRoute {
  method: StudyProxyMethod;
  pattern: RegExp;
  featureFlag: StudyApiChildFlag;
  responseFeature?: LearningOsStudyReadFeature;
  queryParams: ReadonlySet<string>;
  upstreamQueryAliases?: Readonly<Record<string, string>>;
  writeFeature?: StudyWriteFeature;
  writeBody?: StudyWriteBody;
  requiredReadFlag?: Extract<FeatureFlagKey, 'studyApiSettings' | 'studyApiNewQueue'>;
}

const ALLOWED_STUDY_ROUTES: StudyProxyRoute[] = [
  {
    method: 'GET',
    pattern: /^\/overview$/,
    featureFlag: 'studyApiOverview',
    responseFeature: 'overview',
    queryParams: new Set(['timeZone']),
    upstreamQueryAliases: { timeZone: 'time_zone' },
  },
  {
    method: 'GET',
    pattern: /^\/settings$/,
    featureFlag: 'studyApiSettings',
    responseFeature: 'settings',
    queryParams: new Set(),
  },
  {
    method: 'PATCH',
    pattern: /^\/settings$/,
    featureFlag: 'studyApiSettingsWrite',
    responseFeature: 'settings',
    queryParams: new Set(),
    writeFeature: 'settingsWrite',
    writeBody: 'settings',
    requiredReadFlag: 'studyApiSettings',
  },
  {
    method: 'GET',
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
    method: 'GET',
    pattern: /^\/browser\/[A-Za-z0-9-]+$/,
    featureFlag: 'studyApiBrowserDetail',
    responseFeature: 'browserDetail',
    queryParams: new Set(),
  },
  {
    method: 'GET',
    pattern: /^\/new-queue$/,
    featureFlag: 'studyApiNewQueue',
    responseFeature: 'newQueue',
    queryParams: new Set(['cursor', 'limit', 'q']),
  },
  {
    method: 'POST',
    pattern: /^\/new-queue\/reorder$/,
    featureFlag: 'studyApiNewQueueWrite',
    responseFeature: 'newQueue',
    queryParams: new Set(),
    writeFeature: 'newQueueWrite',
    writeBody: 'newQueue',
    requiredReadFlag: 'studyApiNewQueue',
  },
  {
    method: 'GET',
    pattern: /^\/imports\/current$/,
    featureFlag: 'studyApiImports',
    queryParams: new Set(),
  },
  {
    method: 'GET',
    pattern: /^\/imports\/[A-Za-z0-9_-]+$/,
    featureFlag: 'studyApiImports',
    queryParams: new Set(),
  },
  {
    method: 'GET',
    pattern: /^\/known-kanji$/,
    featureFlag: 'studyApiSettings',
    queryParams: new Set(),
  },
  {
    method: 'PATCH',
    pattern: /^\/known-kanji\/manual$/,
    featureFlag: 'studyApiSettingsWrite',
    queryParams: new Set(),
    writeFeature: 'settingsWrite',
    writeBody: 'knownKanjiManual',
    requiredReadFlag: 'studyApiSettings',
  },
  {
    method: 'PUT',
    pattern: /^\/wanikani$/,
    featureFlag: 'studyApiSettingsWrite',
    queryParams: new Set(),
    writeFeature: 'settingsWrite',
    writeBody: 'wanikaniConnection',
    requiredReadFlag: 'studyApiSettings',
  },
  {
    method: 'DELETE',
    pattern: /^\/wanikani$/,
    featureFlag: 'studyApiSettingsWrite',
    queryParams: new Set(),
    writeFeature: 'settingsWrite',
    requiredReadFlag: 'studyApiSettings',
  },
  {
    method: 'POST',
    pattern: /^\/wanikani\/sync$/,
    featureFlag: 'studyApiSettingsWrite',
    queryParams: new Set(),
    writeFeature: 'settingsWrite',
    requiredReadFlag: 'studyApiSettings',
  },
];

function getStudyProxyRoute(method: string, pathname: string): StudyProxyRoute | null {
  return (
    ALLOWED_STUDY_ROUTES.find(
      (route) => route.method === method.toUpperCase() && route.pattern.test(pathname)
    ) ?? null
  );
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

function appendQueryParams(target: URL, query: AuthRequest['query'], route: StudyProxyRoute) {
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

function requestRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AppError('Request body must be a JSON object.', 400);
  }

  return value as Record<string, unknown>;
}

function adaptSettingsWriteBody(value: unknown): { new_cards_per_day: number } {
  const body = requestRecord(value);
  const newCardsPerDay = body.newCardsPerDay;

  if (
    !Number.isInteger(newCardsPerDay) ||
    (newCardsPerDay as number) < 0 ||
    (newCardsPerDay as number) > 1000
  ) {
    throw new AppError('newCardsPerDay must be an integer between 0 and 1000.', 400);
  }

  return { new_cards_per_day: newCardsPerDay as number };
}

function adaptNewQueueWriteBody(value: unknown): { cardIds: string[] } {
  const cardIds = requestRecord(value).cardIds;
  if (
    !Array.isArray(cardIds) ||
    cardIds.length < 1 ||
    cardIds.length > MAX_NEW_QUEUE_REORDER_SIZE
  ) {
    throw new AppError(
      `cardIds must include between 1 and ${MAX_NEW_QUEUE_REORDER_SIZE} cards.`,
      400
    );
  }

  const normalizedCardIds = cardIds.map((cardId) => {
    if (typeof cardId !== 'string' || !ULID_PATTERN.test(cardId)) {
      throw new AppError('Each cardId must be a valid ULID.', 400);
    }

    return cardId.toUpperCase();
  });

  if (new Set(normalizedCardIds).size !== normalizedCardIds.length) {
    throw new AppError('cardIds must not contain duplicates.', 400);
  }

  return { cardIds: normalizedCardIds };
}

function adaptKnownKanjiManualBody(value: unknown): { kanji: string; known: boolean } {
  const body = requestRecord(value);
  const kanji = body.kanji;
  const known = body.known;

  if (typeof kanji !== 'string' || !/^[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]$/u.test(kanji)) {
    throw new AppError('kanji must be exactly one kanji character.', 400);
  }
  if (typeof known !== 'boolean') {
    throw new AppError('known must be a boolean.', 400);
  }

  return { kanji, known };
}

function adaptWaniKaniConnectionBody(value: unknown): { apiToken: string } {
  const apiToken = requestRecord(value).apiToken;
  if (typeof apiToken !== 'string' || apiToken.trim().length < 1 || apiToken.trim().length > 512) {
    throw new AppError('apiToken must be a non-empty string no longer than 512 characters.', 400);
  }

  return { apiToken: apiToken.trim() };
}

function adaptWriteBody(route: StudyProxyRoute, value: unknown): unknown {
  if (route.writeBody === 'settings') {
    return adaptSettingsWriteBody(value);
  }
  if (route.writeBody === 'newQueue') {
    return adaptNewQueueWriteBody(value);
  }
  if (route.writeBody === 'knownKanjiManual') {
    return adaptKnownKanjiManualBody(value);
  }
  if (route.writeBody === 'wanikaniConnection') {
    return adaptWaniKaniConnectionBody(value);
  }

  return undefined;
}

async function assertLearningOsStudyApiEnabled(route: StudyProxyRoute) {
  const flags = await getFeatureFlags();
  if (
    flags?.studyApiEnabled === true &&
    flags[route.featureFlag] === true &&
    (!route.requiredReadFlag || flags[route.requiredReadFlag] === true)
  ) {
    return;
  }

  throw new AppError('Learning OS Study API route is not enabled.', 403);
}

function rateLimitLearningOsStudyRoute(req: AuthRequest, res: Response, next: NextFunction) {
  const route = getStudyProxyRoute(req.method, req.path);
  if (!route) {
    next();
    return;
  }

  if (route.featureFlag === 'studyApiImports') {
    learningOsStudyImportRateLimit(req, res, next);
  } else if (route.writeFeature === 'settingsWrite') {
    learningOsSettingsWriteRateLimit(req, res, next);
  } else if (route.writeFeature === 'newQueueWrite') {
    learningOsNewQueueWriteRateLimit(req, res, next);
  } else {
    learningOsStudyReadRateLimit(req, res, next);
  }
}

interface UserIdentity {
  id: string;
  email: string;
  role: string;
}

async function fetchLearningOsStudy(
  upstreamUrl: URL,
  apiToken: string,
  user: UserIdentity,
  method: StudyProxyMethod,
  body: unknown
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LEARNING_OS_FETCH_TIMEOUT_MS);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${apiToken}`,
    'X-Convo-Lab-User-Id': user.id,
    'X-Convo-Lab-User-Email': user.email,
    'X-Convo-Lab-User-Role': user.role,
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    return await fetch(upstreamUrl, {
      method,
      signal: controller.signal,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
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

function adaptStudyRouteResponse(route: StudyProxyRoute, value: unknown): unknown {
  return route.responseFeature
    ? adaptLearningOsStudyReadResponse(route.responseFeature, value)
    : value;
}

router.all(
  '/*',
  learningOsStudyIpRateLimit,
  requireAuth,
  rateLimitLearningOsStudyRoute,
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new AppError('Authentication required', 401);
      }

      const route = getStudyProxyRoute(req.method, req.path);
      if (!route) {
        throw new AppError('Learning OS Study API route is not allowed.', 404);
      }

      await assertLearningOsStudyApiEnabled(route);

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
      appendQueryParams(upstreamUrl, req.query, route);
      const body = adaptWriteBody(route, req.body);
      const upstreamResponse = await fetchLearningOsStudy(
        upstreamUrl,
        apiToken,
        user,
        route.method,
        body
      );

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

      res.status(upstreamResponse.status).json(adaptStudyRouteResponse(route, responseJson));
    } catch (error) {
      next(error);
    }
  }
);

export default router;
