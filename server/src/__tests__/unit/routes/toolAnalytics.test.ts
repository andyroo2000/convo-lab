import express, { type Application, json } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError, errorHandler } from '../../../middleware/errorHandler.js';
import toolAnalyticsRoutes from '../../../routes/toolAnalytics.js';
import { recordLearningOsToolAnalytics } from '../../../services/toolAnalyticsProxy.js';

vi.mock('../../../services/toolAnalyticsProxy.js', () => ({
  recordLearningOsToolAnalytics: vi.fn(),
}));

describe('toolAnalytics route', () => {
  let app: Application;

  beforeEach(() => {
    app = express();
    app.use(json());
    app.use('/api', toolAnalyticsRoutes);
    app.use(errorHandler);
    vi.mocked(recordLearningOsToolAnalytics).mockResolvedValue();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('accepts sanitized analytics payloads', async () => {
    await request(app)
      .post('/api/tools/analytics')
      .send({
        tool: 'japanese-time-practice',
        event: 'fsrs_graded',
        context: 'public',
        mode: 'fsrs',
        sessionId: 'anon_abc123',
        properties: {
          grade: 'good',
          reveal_delay: 8,
          auto_play: false,
        },
      })
      .expect(204);

    expect(recordLearningOsToolAnalytics).toHaveBeenCalledWith({
      tool: 'japanese-time-practice',
      event: 'fsrs_graded',
      context: 'public',
      mode: 'fsrs',
      sessionId: 'anon_abc123',
      properties: {
        grade: 'good',
        reveal_delay: 8,
        auto_play: false,
      },
    });
  });

  it('preserves legacy defaults and bounds before proxying', async () => {
    await request(app)
      .post('/api/tools/analytics')
      .send({
        tool: 'japanese-time-practice',
        event: 'opened',
        context: 'unknown',
        mode: 'guided',
        sessionId: 'bad session',
        properties: {
          long_value: 'x'.repeat(121),
          nested: { ignored: true },
          ...Object.fromEntries(
            Array.from({ length: 20 }, (_, index) => [`property_${index}`, index])
          ),
        },
      })
      .expect(204);

    expect(recordLearningOsToolAnalytics).toHaveBeenCalledWith({
      tool: 'japanese-time-practice',
      event: 'opened',
      context: 'public',
      properties: {
        long_value: 'x'.repeat(120),
        property_0: 0,
        property_1: 1,
        property_2: 2,
        property_3: 3,
        property_4: 4,
        property_5: 5,
        property_6: 6,
        property_7: 7,
        property_8: 8,
        property_9: 9,
        property_10: 10,
        property_11: 11,
        property_12: 12,
        property_13: 13,
      },
    });
  });

  it('rejects invalid event tokens', async () => {
    const response = await request(app)
      .post('/api/tools/analytics')
      .send({
        tool: 'japanese-time-practice',
        event: 'bad event with spaces',
      })
      .expect(400);

    expect(response.body.error).toBe('Invalid analytics event');
    expect(recordLearningOsToolAnalytics).not.toHaveBeenCalled();
  });

  it('does not hide upstream failures behind a successful response', async () => {
    vi.mocked(recordLearningOsToolAnalytics).mockRejectedValueOnce(
      new AppError('Learning OS Tool Analytics API is unavailable.', 502)
    );

    const response = await request(app)
      .post('/api/tools/analytics')
      .send({
        tool: 'japanese-time-practice',
        event: 'opened',
      })
      .expect(502);

    expect(response.body).toEqual({
      error: {
        message: 'Learning OS Tool Analytics API is unavailable.',
        statusCode: 502,
      },
    });
  });
});
