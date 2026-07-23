import { describe, expect, it } from 'vitest';

import { createAccountApiContract } from '../accountApi';

describe('account API contract', () => {
  it('defaults browser account requests to same-origin Learning OS routes', () => {
    const contract = createAccountApiContract();

    expect(contract.currentUser).toBe('/api/convolab/auth/me');
    expect(contract.quota).toBe('/api/convolab/auth/me/quota');
    expect(contract.passwordPath).toBe('/api/convolab/auth/me/password');
  });

  it('uses Learning OS compatibility routes and canonical security payloads', () => {
    const contract = createAccountApiContract('https://app.example');

    expect(contract.currentUser).toBe('https://app.example/api/convolab/auth/me');
    expect(contract.quota).toBe('https://app.example/api/convolab/auth/me/quota');
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
