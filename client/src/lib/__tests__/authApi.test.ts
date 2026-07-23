import { describe, expect, it } from 'vitest';

import { createAuthApiContract } from '../authApi';

describe('auth API contract', () => {
  it('keeps email and password auth on Express when direct routing is disabled', () => {
    const contract = createAuthApiContract(false, 'https://convo-lab.test');

    expect(contract).toMatchObject({
      login: 'https://convo-lab.test/api/auth/login',
      logout: 'https://convo-lab.test/api/auth/logout',
      signup: 'https://convo-lab.test/api/auth/signup',
      googleStart: 'https://convo-lab.test/api/auth/google',
      claimInvite: 'https://convo-lab.test/api/auth/claim-invite',
      claimInviteRequiresToken: true,
      resendVerification: 'https://convo-lab.test/api/verification/send',
      forgotPassword: 'https://convo-lab.test/api/password-reset/request',
      resetPassword: 'https://convo-lab.test/api/password-reset/verify',
    });
    expect(contract.claimInviteBody('WELCOME', 'legacy-token')).toEqual({
      inviteCode: 'WELCOME',
      token: 'legacy-token',
    });
    expect(contract.verifyEmail('token/with spaces')).toEqual({
      url: 'https://convo-lab.test/api/verification/token%2Fwith%20spaces',
      init: { credentials: 'include' },
    });
    expect(contract.resetPasswordBody('ada@example.com', 'reset-token', 'new-password')).toEqual({
      email: 'ada@example.com',
      token: 'reset-token',
      newPassword: 'new-password',
    });
  });

  it('uses first-party Learning OS browser auth and canonical reset payloads when enabled', () => {
    const contract = createAuthApiContract(true, '');

    expect(contract).toMatchObject({
      login: '/api/convolab/browser/auth/login',
      logout: '/api/convolab/browser/auth/logout',
      signup: '/api/convolab/browser/auth/signup',
      googleStart: '/api/convolab/browser/auth/google',
      claimInvite: '/api/convolab/browser/auth/google/invite',
      claimInviteRequiresToken: false,
      resendVerification: '/api/convolab/browser/auth/verification/send',
      forgotPassword: '/api/auth/password/forgot',
      resetPassword: '/api/auth/password/reset',
    });
    expect(contract.claimInviteBody('WELCOME', 'must-not-leak')).toEqual({
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
