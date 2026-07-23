import { describe, expect, it } from 'vitest';

import { createAuthApiContract } from '../authApi';

describe('auth API contract', () => {
  it('keeps email and password auth on Express when direct routing is disabled', () => {
    const contract = createAuthApiContract(false, 'https://convo-lab.test');

    expect(contract).toMatchObject({
      login: 'https://convo-lab.test/api/auth/login',
      logout: 'https://convo-lab.test/api/auth/logout',
      signup: 'https://convo-lab.test/api/auth/signup',
      forgotPassword: 'https://convo-lab.test/api/password-reset/request',
      resetPassword: 'https://convo-lab.test/api/password-reset/verify',
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
      forgotPassword: '/api/auth/password/forgot',
      resetPassword: '/api/auth/password/reset',
    });
    expect(contract.resetPasswordBody('ada@example.com', 'reset-token', 'new-password')).toEqual({
      email: 'ada@example.com',
      token: 'reset-token',
      password: 'new-password',
      password_confirmation: 'new-password',
    });
  });
});
