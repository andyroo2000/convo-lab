import { describe, expect, it } from 'vitest';

import {
  getClientRuntimeConfig,
  injectClientRuntimeConfig,
} from '../../../config/clientRuntimeConfig.js';

describe('client runtime config', () => {
  it('keeps direct account traffic disabled unless explicitly enabled', () => {
    expect(getClientRuntimeConfig({})).toEqual({
      learningOsDirectAccountApi: false,
      learningOsDirectEpisodeApi: false,
    });
    expect(
      getClientRuntimeConfig({
        LEARNING_OS_DIRECT_ACCOUNT_API_ENABLED: ' TRUE ',
      })
    ).toEqual({
      learningOsDirectAccountApi: true,
      learningOsDirectEpisodeApi: false,
    });
    expect(
      getClientRuntimeConfig({
        LEARNING_OS_DIRECT_ACCOUNT_API_ENABLED: '1',
      })
    ).toEqual({
      learningOsDirectAccountApi: false,
      learningOsDirectEpisodeApi: false,
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
    });
    expect(
      getClientRuntimeConfig({
        LEARNING_OS_DIRECT_EPISODE_API_ENABLED: '1',
      })
    ).toEqual({
      learningOsDirectAccountApi: false,
      learningOsDirectEpisodeApi: false,
    });
  });

  it('injects the runtime config before the closing head tag', () => {
    const html = '<html><head></head><body></body></html>';
    const injected = injectClientRuntimeConfig(html, {
      learningOsDirectAccountApi: true,
      learningOsDirectEpisodeApi: true,
    });

    expect(injected).toContain(
      '<script>window.__CONVOLAB_RUNTIME_CONFIG__={"learningOsDirectAccountApi":true,"learningOsDirectEpisodeApi":true};</script>'
    );
    expect(injected).toContain('</head>');
  });
});
