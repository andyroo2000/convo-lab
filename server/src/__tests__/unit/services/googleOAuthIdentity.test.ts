import type { Profile } from 'passport-google-oauth20';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveVerifiedGoogleProfile } from '../../../services/googleOAuthIdentity.js';
import { resolveLearningOsGoogleIdentity } from '../../../services/learningOsAuthProxy.js';

vi.mock('../../../services/learningOsAuthProxy.js', () => ({
  resolveLearningOsGoogleIdentity: vi.fn(),
}));

const profile = (overrides: Partial<Profile> = {}): Profile =>
  ({
    id: 'google-subject-123',
    provider: 'google',
    profileUrl: 'https://profiles.google.com/google-subject-123',
    displayName: 'Ada Lovelace',
    emails: [{ value: 'ada@example.com', verified: true }],
    photos: [{ value: 'https://example.com/ada.png' }],
    _raw: '{}',
    _json: {
      sub: 'google-subject-123',
      iss: 'https://accounts.google.com',
      aud: 'client',
      iat: 1,
      exp: 2,
    },
    ...overrides,
  }) as Profile;

describe('Google OAuth identity resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveLearningOsGoogleIdentity).mockResolvedValue({
      user: {} as never,
      requiresInvite: true,
      created: true,
    });
  });

  it('forwards only verified profile claims and never forwards Google credentials', async () => {
    await resolveVerifiedGoogleProfile(profile());

    expect(resolveLearningOsGoogleIdentity).toHaveBeenCalledWith({
      providerId: 'google-subject-123',
      email: 'ada@example.com',
      emailVerified: true,
      name: 'Ada Lovelace',
      avatarUrl: 'https://example.com/ada.png',
    });
  });

  it.each([
    ['missing', undefined, 'No email provided by Google'],
    ['unverified', [{ value: 'ada@example.com', verified: false }], 'Google email is not verified'],
  ] as const)(
    'rejects a %s Google email before account lookup',
    async (_label, emails, message) => {
      await expect(
        resolveVerifiedGoogleProfile(profile({ emails: emails ? [...emails] : undefined }))
      ).rejects.toThrow(message);
      expect(resolveLearningOsGoogleIdentity).not.toHaveBeenCalled();
    }
  );

  it('uses bounded fallbacks for optional profile fields', async () => {
    await resolveVerifiedGoogleProfile(
      profile({ displayName: '', name: undefined, photos: undefined })
    );

    expect(resolveLearningOsGoogleIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'User', avatarUrl: null })
    );
  });
});
