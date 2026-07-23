import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import {
  getClientRuntimeConfig,
  injectClientRuntimeConfig,
  redirectClientIndexDocument,
} from '../../../config/clientRuntimeConfig.js';

describe('client runtime config', () => {
  it('redirects direct index document requests through the injected root route', async () => {
    const app = express();
    app.get('/index.html', redirectClientIndexDocument);

    const response = await request(app).get('/index.html');

    expect(response.status).toBe(308);
    expect(response.headers.location).toBe('/');
  });

  it('keeps direct account traffic disabled unless explicitly enabled', () => {
    expect(getClientRuntimeConfig({})).toEqual({
      learningOsDirectAccountApi: false,
      learningOsDirectEpisodeApi: false,
      learningOsDirectCourseApi: false,
    });
    expect(
      getClientRuntimeConfig({
        LEARNING_OS_DIRECT_ACCOUNT_API_ENABLED: ' TRUE ',
      })
    ).toEqual({
      learningOsDirectAccountApi: true,
      learningOsDirectEpisodeApi: false,
      learningOsDirectCourseApi: false,
    });
    expect(
      getClientRuntimeConfig({
        LEARNING_OS_DIRECT_ACCOUNT_API_ENABLED: '1',
      })
    ).toEqual({
      learningOsDirectAccountApi: false,
      learningOsDirectEpisodeApi: false,
      learningOsDirectCourseApi: false,
    });
  });

  it('keeps direct episode traffic disabled unless explicitly enabled', () => {
    expect(
      getClientRuntimeConfig({
        LEARNING_OS_DIRECT_EPISODE_API_ENABLED: ' TRUE ',
      })
    ).toEqual({
      learningOsDirectAccountApi: false,
      learningOsDirectEpisodeApi: true,
      learningOsDirectCourseApi: false,
    });
    expect(
      getClientRuntimeConfig({
        LEARNING_OS_DIRECT_EPISODE_API_ENABLED: '1',
      })
    ).toEqual({
      learningOsDirectAccountApi: false,
      learningOsDirectEpisodeApi: false,
      learningOsDirectCourseApi: false,
    });
  });

  it('keeps direct course traffic disabled unless explicitly enabled', () => {
    expect(
      getClientRuntimeConfig({
        LEARNING_OS_DIRECT_COURSE_API_ENABLED: ' TRUE ',
      })
    ).toEqual({
      learningOsDirectAccountApi: false,
      learningOsDirectEpisodeApi: false,
      learningOsDirectCourseApi: true,
    });
    expect(
      getClientRuntimeConfig({
        LEARNING_OS_DIRECT_COURSE_API_ENABLED: '1',
      })
    ).toEqual({
      learningOsDirectAccountApi: false,
      learningOsDirectEpisodeApi: false,
      learningOsDirectCourseApi: false,
    });
  });

  it('injects the runtime config before the closing head tag', () => {
    const html = '<html><head></head><body></body></html>';
    const injected = injectClientRuntimeConfig(html, {
      learningOsDirectAccountApi: true,
      learningOsDirectEpisodeApi: true,
      learningOsDirectCourseApi: true,
    });

    expect(injected).toContain(
      '<script>window.__CONVOLAB_RUNTIME_CONFIG__={"learningOsDirectAccountApi":true,"learningOsDirectEpisodeApi":true,"learningOsDirectCourseApi":true};</script>'
    );
    expect(injected).toContain('</head>');
  });
});
