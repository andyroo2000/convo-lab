import express, { type Application, json } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import toolAnalyticsRoutes from '../../../routes/toolAnalytics.js';

describe('toolAnalytics route', () => {
  let app: Application;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    app = express();
    app.use(json());
    app.use('/api', toolAnalyticsRoutes);
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
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

    expect(stdoutSpy).toHaveBeenCalledOnce();
    const writeArg = stdoutSpy.mock.calls[0][0];
    expect(String(writeArg)).toContain('"type":"tool_analytics"');
    expect(String(writeArg)).toContain('"tool":"japanese-time-practice"');
    expect(String(writeArg)).toContain('"event":"fsrs_graded"');
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
    expect(stdoutSpy).not.toHaveBeenCalled();
  });
});
