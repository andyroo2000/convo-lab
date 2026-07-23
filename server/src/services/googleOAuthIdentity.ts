import type { Profile } from 'passport-google-oauth20';

import {
  resolveLearningOsGoogleIdentity,
  type LearningOsGoogleIdentityResult,
} from './learningOsAuthProxy.js';

export class GoogleOAuthProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleOAuthProfileError';
  }
}

export async function resolveVerifiedGoogleProfile(
  profile: Profile
): Promise<LearningOsGoogleIdentityResult> {
  const googleEmail = profile.emails?.[0];
  if (!googleEmail?.value) {
    throw new GoogleOAuthProfileError('No email provided by Google');
  }
  if (googleEmail.verified !== true) {
    throw new GoogleOAuthProfileError('Google email is not verified');
  }

  return resolveLearningOsGoogleIdentity({
    providerId: profile.id,
    email: googleEmail.value,
    emailVerified: true,
    name: profile.displayName || profile.name?.givenName || 'User',
    avatarUrl: profile.photos?.[0]?.value ?? null,
  });
}
