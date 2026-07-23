import { describe, expect, it } from 'vitest';

import { createAccountApiContract } from '../accountApi';

describe('account API contract', () => {
  it('preserves legacy Express routes and payloads while disabled', () => {
    const contract = createAccountApiContract(false, 'https://app.example');

    expect(contract.currentUser).toBe('https://app.example/api/auth/me');
    expect(contract.quota).toBe('https://app.example/api/auth/me/quota');
    expect(contract.resendVerification).toBe('https://app.example/api/verification/send');
    expect(contract.passwordMethod).toBe('PATCH');
    expect(contract.passwordPath).toBe('https://app.example/api/auth/change-password');
    expect(contract.passwordBody('old', 'new-password')).toEqual({
      currentPassword: 'old',
      newPassword: 'new-password',
    });
    expect(contract.deleteBody('old')).toEqual({ currentPassword: 'old' });
  });

  it('uses Learning OS compatibility routes and canonical security payloads when enabled', () => {
    const contract = createAccountApiContract(true, 'https://app.example');

    expect(contract.currentUser).toBe('https://app.example/api/convolab/auth/me');
    expect(contract.quota).toBe('https://app.example/api/convolab/auth/me/quota');
    expect(contract.resendVerification).toBe(
      'https://app.example/api/convolab/auth/verification/send'
    );
    expect(contract.passwordMethod).toBe('PUT');
    expect(contract.passwordPath).toBe('https://app.example/api/convolab/auth/me/password');
    expect(contract.passwordBody('old', 'new-password')).toEqual({
      current_password: 'old',
      password: 'new-password',
      password_confirmation: 'new-password',
    });
    expect(contract.deleteBody('old')).toEqual({ current_password: 'old' });
  });
});
