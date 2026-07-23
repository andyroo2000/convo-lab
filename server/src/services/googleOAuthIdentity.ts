import type { Profile } from 'passport-google-oauth20';

import {
  resolveLearningOsGoogleIdentity,
  type LearningOsGoogleIdentityResult,
} from './learningOsAuthProxy.js';

export async function resolveVerifiedGoogleProfile(
  profile: Profile
): Promise<LearningOsGoogleIdentityResult> {
  const googleEmail = profile.emails?.[0];
  if (!googleEmail?.value) {
    throw new Error('No email provided by Google');
  }
  if (googleEmail.verified !== true) {
    throw new Error('Google email is not verified');
  }

  return resolveLearningOsGoogleIdentity({
    providerId: profile.id,
    email: googleEmail.value,
    emailVerified: true,
    name: profile.displayName || profile.name?.givenName || 'User',
    avatarUrl: profile.photos?.[0]?.value ?? null,
  });
}
