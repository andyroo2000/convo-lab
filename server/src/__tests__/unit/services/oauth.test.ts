import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../db/client.js', () => ({
  prisma: {
    oAuthAccount: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
  },
}));

// Import after mocks are set up
import { prisma } from '../../../db/client.js';
import { revokeGoogleTokens, getValidAccessToken } from '../../../services/oauth.js';

// Mock global fetch
global.fetch = vi.fn();

describe('OAuth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getValidAccessToken', () => {
    it('should return null when no OAuth account exists', async () => {
      vi.mocked(prisma.oAuthAccount.findFirst).mockResolvedValue(null);

      const result = await getValidAccessToken('user-123');

      expect(result).toBeNull();
    });

    it('should return existing token when not expired', async () => {
      const futureDate = new Date(Date.now() + 30 * 60 * 1000); // 30 mins from now
      vi.mocked(prisma.oAuthAccount.findFirst).mockResolvedValue({
        id: 'account-1',
        userId: 'user-123',
        provider: 'google',
        providerId: 'google-123',
        accessToken: 'valid-access-token',
        refreshToken: 'refresh-token',
        expiresAt: futureDate,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await getValidAccessToken('user-123');

      expect(result).toBe('valid-access-token');
    });

    it('should return null when token is expired and no refresh token', async () => {
      const pastDate = new Date(Date.now() - 60 * 1000); // 1 min ago
      vi.mocked(prisma.oAuthAccount.findFirst).mockResolvedValue({
        id: 'account-1',
        userId: 'user-123',
        provider: 'google',
        providerId: 'google-123',
        accessToken: 'expired-access-token',
        refreshToken: null, // No refresh token
        expiresAt: pastDate,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await getValidAccessToken('user-123');

      // Should return the expired token since there's no refresh token
      expect(result).toBe('expired-access-token');
    });
  });

  describe('revokeGoogleTokens', () => {
    it('should return false when no OAuth account exists', async () => {
      vi.mocked(prisma.oAuthAccount.findFirst).mockResolvedValue(null);

      const result = await revokeGoogleTokens('user-123');

      expect(result).toBe(false);
    });

    it('should revoke token and delete account', async () => {
      const mockAccount = {
        id: 'account-1',
        userId: 'user-123',
        provider: 'google',
        providerId: 'google-123',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.oAuthAccount.findFirst).mockResolvedValue(mockAccount);
      vi.mocked(prisma.oAuthAccount.delete).mockResolvedValue(mockAccount);
      vi.mocked(prisma.user.update).mockResolvedValue({} as never);
      vi.mocked(global.fetch).mockResolvedValue({ ok: true } as never);

      const result = await revokeGoogleTokens('user-123');

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/revoke?token=access-token',
        expect.objectContaining({ method: 'POST' })
      );
      expect(prisma.oAuthAccount.delete).toHaveBeenCalledWith({
        where: { id: 'account-1' },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { googleId: null },
      });
    });

    it('should still succeed if Google revocation fails', async () => {
      const mockAccount = {
        id: 'account-1',
        userId: 'user-123',
        provider: 'google',
        providerId: 'google-123',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.oAuthAccount.findFirst).mockResolvedValue(mockAccount);
      vi.mocked(prisma.oAuthAccount.delete).mockResolvedValue(mockAccount);
      vi.mocked(prisma.user.update).mockResolvedValue({} as never);
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      const result = await revokeGoogleTokens('user-123');

      expect(result).toBe(true);
      expect(prisma.oAuthAccount.delete).toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('should handle account with no access token', async () => {
      const mockAccount = {
        id: 'account-1',
        userId: 'user-123',
        provider: 'google',
        providerId: 'google-123',
        accessToken: null, // No access token
        refreshToken: 'refresh-token',
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.oAuthAccount.findFirst).mockResolvedValue(mockAccount);
      vi.mocked(prisma.oAuthAccount.delete).mockResolvedValue(mockAccount);
      vi.mocked(prisma.user.update).mockResolvedValue({} as never);

      const result = await revokeGoogleTokens('user-123');

      expect(result).toBe(true);
      // Should not call fetch since there's no access token
      expect(global.fetch).not.toHaveBeenCalled();
      expect(prisma.oAuthAccount.delete).toHaveBeenCalled();
    });
  });
});
