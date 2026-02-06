import { User } from '@prisma/client';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

import { prisma } from '../db/client.js';

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn('Google OAuth credentials not set - Google login will not work');
}

// Configure Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || 'placeholder',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'placeholder',
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists with this Google ID
        const user = await prisma.user.findUnique({
          where: { googleId: profile.id },
        });

        if (user) {
          // User exists, update OAuth account tokens
          await prisma.oAuthAccount.upsert({
            where: {
              provider_providerId: {
                provider: 'google',
                providerId: profile.id,
              },
            },
            update: {
              accessToken,
              refreshToken,
              expiresAt: new Date(Date.now() + 60 * 60 * 1000), // Access token expires in 1 hour
            },
            create: {
              userId: user.id,
              provider: 'google',
              providerId: profile.id,
              accessToken,
              refreshToken,
              expiresAt: new Date(Date.now() + 60 * 60 * 1000), // Access token expires in 1 hour
            },
          });

          // Mark as existing user (already authenticated before)
          return done(null, { ...user, isExistingUser: true });
        }

        // Check if user exists with this email
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('No email provided by Google'), undefined);
        }

        const existingUser = await prisma.user.findUnique({
          where: { email },
        });

        if (existingUser) {
          // Link Google account to existing user
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              googleId: profile.id,
              emailVerified: true, // Google accounts are pre-verified
              emailVerifiedAt: new Date(),
            },
          });

          // Create OAuth account record
          await prisma.oAuthAccount.create({
            data: {
              userId: existingUser.id,
              provider: 'google',
              providerId: profile.id,
              accessToken,
              refreshToken,
              expiresAt: new Date(Date.now() + 60 * 60 * 1000), // Access token expires in 1 hour
            },
          });

          // Mark this user as existing (not newly created via OAuth)
          return done(null, { ...existingUser, isExistingUser: true });
        }

        // New user - create account but mark as needing invite code
        // We'll handle invite code verification in the callback route
        const newUser = await prisma.user.create({
          data: {
            email,
            name: profile.displayName || profile.name?.givenName || 'User',
            googleId: profile.id,
            emailVerified: true, // Google accounts are pre-verified
            emailVerifiedAt: new Date(),
            avatarUrl: profile.photos?.[0]?.value,
          },
        });

        // Create OAuth account record
        await prisma.oAuthAccount.create({
          data: {
            userId: newUser.id,
            provider: 'google',
            providerId: profile.id,
            accessToken,
            refreshToken,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000), // Access token expires in 1 hour
          },
        });

        // Mark this user as newly created (needs invite code)
        return done(null, { ...newUser, isNewOAuthUser: true });
      } catch (error) {
        console.error('OAuth error:', error);
        return done(error as Error, undefined);
      }
    }
  )
);

// Serialize user for session
passport.serializeUser(
  (user: User & { isExistingUser?: boolean; isNewOAuthUser?: boolean }, done) => {
    done(null, user.id);
  }
);

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
    });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
