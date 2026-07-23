import type { Profile, VerifyCallback } from 'passport-google-oauth20';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveVerifiedGoogleProfile: vi.fn(),
  strategyVerify: undefined as
    | ((
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: VerifyCallback
      ) => Promise<void>)
    | undefined,
  use: vi.fn(),
}));

vi.mock('passport', () => ({
  default: { use: mocks.use },
}));
vi.mock('passport-google-oauth20', () => ({
  Strategy: class {
    constructor(
      _options: unknown,
      verify: (
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: VerifyCallback
      ) => Promise<void>
    ) {
      mocks.strategyVerify = verify;
    }
  },
}));
vi.mock('../../../services/googleOAuthIdentity.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/googleOAuthIdentity.js')>();
  return {
    ...actual,
    resolveVerifiedGoogleProfile: mocks.resolveVerifiedGoogleProfile,
  };
});

await import('../../../config/passport.js');

const profile = { id: 'google-subject-123' } as Profile;

describe('Google Passport strategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes the Learning OS account and invite state to Passport', async () => {
    const user = { id: '11111111-1111-4111-8111-111111111111' };
    mocks.resolveVerifiedGoogleProfile.mockResolvedValue({
      user,
      requiresInvite: true,
      created: true,
    });
    const done = vi.fn();

    await mocks.strategyVerify!('ignored-access-token', 'ignored-refresh-token', profile, done);

    expect(done).toHaveBeenCalledWith(null, { ...user, requiresInvite: true });
  });

  it('turns rejected Google profile claims into the configured failure redirect', async () => {
    const { GoogleOAuthProfileError } = await import('../../../services/googleOAuthIdentity.js');
    mocks.resolveVerifiedGoogleProfile.mockRejectedValue(
      new GoogleOAuthProfileError('Google email is not verified')
    );
    const done = vi.fn();

    await mocks.strategyVerify!('ignored-access-token', 'ignored-refresh-token', profile, done);

    expect(done).toHaveBeenCalledWith(null, false, {
      message: 'Google email is not verified',
    });
  });

  it('preserves unexpected upstream errors for the Express error handler', async () => {
    const error = new Error('Learning OS unavailable');
    mocks.resolveVerifiedGoogleProfile.mockRejectedValue(error);
    const done = vi.fn();

    await mocks.strategyVerify!('ignored-access-token', 'ignored-refresh-token', profile, done);

    expect(done).toHaveBeenCalledWith(error, undefined);
  });
});
