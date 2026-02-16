import { google } from 'googleapis';

import { prisma } from '../db/client.js';

/**
 * Refresh an expired Google OAuth access token using the stored refresh token.
 * Updates the database with the new access token and expiration time.
 *
 * @param userId - The user ID to refresh tokens for
 * @returns The new access token
 * @throws Error if no refresh token is available or refresh fails
 */
export async function refreshGoogleToken(userId: string): Promise<string> {
  const account = await prisma.oAuthAccount.findFirst({
    where: { userId, provider: 'google' },
  });

  if (!account?.refreshToken) {
    throw new Error('No refresh token available');
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({ refresh_token: account.refreshToken });

  const { credentials } = await oauth2Client.refreshAccessToken();

  await prisma.oAuthAccount.update({
    where: { id: account.id },
    data: {
      accessToken: credentials.access_token,
      expiresAt: credentials.expiry_date
        ? new Date(credentials.expiry_date)
        : new Date(Date.now() + 60 * 60 * 1000), // Default to 1 hour
    },
  });

  return credentials.access_token!;
}

/**
 * Get a valid access token for a user, refreshing if necessary.
 * If the token is expired or about to expire (within 5 minutes), it will be refreshed.
 *
 * @param userId - The user ID to get a token for
 * @returns The access token, or null if no OAuth account exists
 */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const account = await prisma.oAuthAccount.findFirst({
    where: { userId, provider: 'google' },
  });

  if (!account) return null;

  // Check if token is expired or about to expire (5 min buffer)
  const isExpired = account.expiresAt && account.expiresAt < new Date(Date.now() + 5 * 60 * 1000);

  if (isExpired && account.refreshToken) {
    try {
      return await refreshGoogleToken(userId);
    } catch (error) {
      console.error('Failed to refresh Google token:', error);
      return null;
    }
  }

  return account.accessToken;
}

/**
 * Revoke a user's Google OAuth tokens and remove the OAuth account link.
 * This will:
 * 1. Revoke the access token with Google's API
 * 2. Delete the OAuthAccount record
 * 3. Clear the googleId from the User record
 *
 * @param userId - The user ID to revoke tokens for
 * @returns true if successful, false if no account was found
 */
export async function revokeGoogleTokens(userId: string): Promise<boolean> {
  const account = await prisma.oAuthAccount.findFirst({
    where: { userId, provider: 'google' },
  });

  if (!account) {
    return false;
  }

  // Try to revoke the token with Google (best effort)
  if (account.accessToken) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${account.accessToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    } catch (error) {
      // Log but don't fail - the token might already be invalid
      console.warn('Failed to revoke token with Google:', error);
    }
  }

  // Delete the OAuth account record
  await prisma.oAuthAccount.delete({
    where: { id: account.id },
  });

  // Clear the googleId from the user
  await prisma.user.update({
    where: { id: userId },
    data: { googleId: null },
  });

  return true;
}
