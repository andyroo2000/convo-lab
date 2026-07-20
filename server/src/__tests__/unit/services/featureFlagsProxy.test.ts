import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  parseClientFeatureFlagsPatch,
  updateLearningOsFeatureFlags,
} from '../../../services/featureFlagsProxy.js';
import { mockPrisma } from '../../setup.js';

const featureFlags = {
  id: 'flag-1',
  dialoguesEnabled: false,
  scriptsEnabled: true,
  audioCourseEnabled: true,
  flashcardsEnabled: true,
  updatedAt: '2026-07-20T18:16:12.345Z',
};

describe('Feature Flags Proxy Service', () => {
  const originalLearningOsApiUrl = process.env.LEARNING_OS_API_URL;
  const originalLearningOsApiToken = process.env.LEARNING_OS_API_TOKEN;
  const originalLearningOsProxyUserEmail = process.env.LEARNING_OS_PROXY_USER_EMAIL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LEARNING_OS_API_URL = 'https://learning-os.example/';
    process.env.LEARNING_OS_API_TOKEN = 'server-only-token';
    process.env.LEARNING_OS_PROXY_USER_EMAIL = 'proxy@example.com';
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'proxy-user',
      email: 'proxy@example.com',
      role: 'admin',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(featureFlags), { status: 200 }))
    );
  });

  afterEach(() => {
    process.env.LEARNING_OS_API_URL = originalLearningOsApiUrl;
    process.env.LEARNING_OS_API_TOKEN = originalLearningOsApiToken;
    process.env.LEARNING_OS_PROXY_USER_EMAIL = originalLearningOsProxyUserEmail;
    vi.unstubAllGlobals();
  });

  it('forwards a sparse update with the service identity and JSON body', async () => {
    await expect(updateLearningOsFeatureFlags({ dialoguesEnabled: false })).resolves.toEqual(
      featureFlags
    );

    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://learning-os.example/api/feature-flags');
    expect(init).toMatchObject({
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer server-only-token',
        'Content-Type': 'application/json',
        'X-Convo-Lab-User-Id': 'proxy-user',
        'X-Convo-Lab-User-Email': 'proxy@example.com',
        'X-Convo-Lab-User-Role': 'admin',
      },
      body: JSON.stringify({ dialoguesEnabled: false }),
    });
  });

  it('keeps only supported boolean patch fields', () => {
    expect(
      parseClientFeatureFlagsPatch({
        dialoguesEnabled: false,
        scriptsEnabled: true,
        internalValue: true,
      })
    ).toEqual({
      dialoguesEnabled: false,
      scriptsEnabled: true,
    });
  });
});
