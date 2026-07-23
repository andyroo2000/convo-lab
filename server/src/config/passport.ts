import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

import {
  GoogleOAuthProfileError,
  resolveVerifiedGoogleProfile,
} from '../services/googleOAuthIdentity.js';

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn('Google OAuth credentials not set - Google login will not work');
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || 'placeholder',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'placeholder',
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback',
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const result = await resolveVerifiedGoogleProfile(profile);
        return done(null, { ...result.user, requiresInvite: result.requiresInvite });
      } catch (error) {
        if (error instanceof GoogleOAuthProfileError) {
          return done(null, false, { message: error.message });
        }
        console.error('OAuth error:', error);
        return done(error as Error, undefined);
      }
    }
  )
);

export default passport;
