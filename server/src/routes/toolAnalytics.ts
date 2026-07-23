import { Router } from 'express';
import { rateLimit as createExpressRateLimit } from 'express-rate-limit';

import {
  recordLearningOsToolAnalytics,
  type ToolAnalyticsValue,
} from '../services/toolAnalyticsProxy.js';

const router = Router();

const MAX_TOKEN_LENGTH = 80;
const MAX_PROPERTY_KEY_LENGTH = 40;
const MAX_PROPERTY_VALUE_LENGTH = 120;
const MAX_PROPERTIES = 16;
const toolAnalyticsIpRateLimit = createExpressRateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSafeToken(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_TOKEN_LENGTH &&
    /^[a-z0-9:_-]+$/i.test(value)
  );
}

function sanitizeProperties(input: unknown): Record<string, ToolAnalyticsValue> {
  if (!isRecord(input)) {
    return {};
  }

  return Object.entries(input)
    .slice(0, MAX_PROPERTIES)
    .reduce<Record<string, ToolAnalyticsValue>>((acc, [key, value]) => {
      if (!key || key.length > MAX_PROPERTY_KEY_LENGTH || !/^[a-z0-9:_-]+$/i.test(key)) {
        return acc;
      }

      if (value === null || typeof value === 'boolean') {
        acc[key] = value as boolean | null;
        return acc;
      }

      if (typeof value === 'number' && Number.isFinite(value)) {
        acc[key] = value;
        return acc;
      }

      if (typeof value === 'string') {
        acc[key] = value.slice(0, MAX_PROPERTY_VALUE_LENGTH);
        return acc;
      }

      return acc;
    }, {});
}

router.post('/tools/analytics', toolAnalyticsIpRateLimit, async (req, res, next) => {
  try {
    const payload = req.body as unknown;
    if (!isRecord(payload)) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    const { tool, event, context, sessionId, mode } = payload;
    if (!isSafeToken(tool) || !isSafeToken(event)) {
      res.status(400).json({ error: 'Invalid analytics event' });
      return;
    }

    await recordLearningOsToolAnalytics({
      tool,
      event,
      context: context === 'app' || context === 'public' ? context : 'public',
      ...(mode === 'fsrs' || mode === 'random' ? { mode } : {}),
      ...(isSafeToken(sessionId) ? { sessionId } : {}),
      properties: sanitizeProperties(payload.properties),
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
