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

  it('keeps direct episode traffic disabled unless explicitly enabled', () => {
    expect(
      getClientRuntimeConfig({
        LEARNING_OS_DIRECT_EPISODE_API_ENABLED: ' TRUE ',
      })
    ).toEqual({
      learningOsDirectEpisodeApi: true,
      learningOsDirectCourseApi: false,
      learningOsDirectScriptApi: false,
      learningOsDirectAdminApi: false,
    });
    expect(
      getClientRuntimeConfig({
        LEARNING_OS_DIRECT_EPISODE_API_ENABLED: '1',
      })
    ).toEqual({
      learningOsDirectEpisodeApi: false,
      learningOsDirectCourseApi: false,
      learningOsDirectScriptApi: false,
      learningOsDirectAdminApi: false,
    });
  });

  it('keeps direct course traffic disabled unless explicitly enabled', () => {
    expect(
      getClientRuntimeConfig({
        LEARNING_OS_DIRECT_COURSE_API_ENABLED: ' TRUE ',
      })
    ).toEqual({
      learningOsDirectEpisodeApi: false,
      learningOsDirectCourseApi: true,
      learningOsDirectScriptApi: false,
      learningOsDirectAdminApi: false,
    });
    expect(
      getClientRuntimeConfig({
        LEARNING_OS_DIRECT_COURSE_API_ENABLED: '1',
      })
    ).toEqual({
      learningOsDirectEpisodeApi: false,
      learningOsDirectCourseApi: false,
      learningOsDirectScriptApi: false,
      learningOsDirectAdminApi: false,
    });
  });

  it('keeps direct script traffic disabled unless explicitly enabled', () => {
    expect(
      getClientRuntimeConfig({
        LEARNING_OS_DIRECT_SCRIPT_API_ENABLED: ' TRUE ',
      })
    ).toEqual({
      learningOsDirectEpisodeApi: false,
      learningOsDirectCourseApi: false,
      learningOsDirectScriptApi: true,
      learningOsDirectAdminApi: false,
    });
    expect(
      getClientRuntimeConfig({
        LEARNING_OS_DIRECT_SCRIPT_API_ENABLED: '1',
      })
    ).toEqual({
      learningOsDirectEpisodeApi: false,
      learningOsDirectCourseApi: false,
      learningOsDirectScriptApi: false,
      learningOsDirectAdminApi: false,
    });
  });

  it('keeps direct admin traffic disabled unless explicitly enabled', () => {
    expect(
      getClientRuntimeConfig({
        LEARNING_OS_DIRECT_ADMIN_API_ENABLED: ' TRUE ',
      })
    ).toEqual({
      learningOsDirectEpisodeApi: false,
      learningOsDirectCourseApi: false,
      learningOsDirectScriptApi: false,
      learningOsDirectAdminApi: true,
    });
    expect(
      getClientRuntimeConfig({
        LEARNING_OS_DIRECT_ADMIN_API_ENABLED: '1',
      })
    ).toEqual({
      learningOsDirectEpisodeApi: false,
      learningOsDirectCourseApi: false,
      learningOsDirectScriptApi: false,
      learningOsDirectAdminApi: false,
    });
  });

  it('injects the runtime config before the closing head tag', () => {
    const html = '<html><head></head><body></body></html>';
    const injected = injectClientRuntimeConfig(html, {
      learningOsDirectEpisodeApi: true,
      learningOsDirectCourseApi: true,
      learningOsDirectScriptApi: true,
      learningOsDirectAdminApi: true,
    });

    expect(injected).toContain(
      '<script>window.__CONVOLAB_RUNTIME_CONFIG__={"learningOsDirectEpisodeApi":true,"learningOsDirectCourseApi":true,"learningOsDirectScriptApi":true,"learningOsDirectAdminApi":true};</script>'
    );
    expect(injected).toContain('</head>');
  });
});
