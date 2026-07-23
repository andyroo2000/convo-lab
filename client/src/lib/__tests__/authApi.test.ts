import { describe, expect, it } from 'vitest';

import { createAuthApiContract } from '../authApi';

describe('auth API contract', () => {
  it('uses first-party Learning OS browser auth and canonical reset payloads', () => {
    const contract = createAuthApiContract();

    expect(contract).toMatchObject({
      login: '/api/convolab/browser/auth/login',
      logout: '/api/convolab/browser/auth/logout',
      signup: '/api/convolab/browser/auth/signup',
      googleStart: '/api/convolab/browser/auth/google',
      claimInvite: '/api/convolab/browser/auth/google/invite',
      resendVerification: '/api/convolab/browser/auth/verification/send',
      forgotPassword: '/api/auth/password/forgot',
      resetPassword: '/api/auth/password/reset',
    });
    expect(contract.claimInviteBody('WELCOME')).toEqual({
      inviteCode: 'WELCOME',
    });
    expect(contract.verifyEmail('verification-token')).toEqual({
      url: '/api/convolab/browser/auth/verification',
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: 'verification-token' }),
      },
    });
    expect(contract.resetPasswordBody('ada@example.com', 'reset-token', 'new-password')).toEqual({
      email: 'ada@example.com',
      token: 'reset-token',
      password: 'new-password',
      password_confirmation: 'new-password',
    });
  });
});
