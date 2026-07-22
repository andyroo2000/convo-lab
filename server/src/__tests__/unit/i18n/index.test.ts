import { describe, expect, it } from 'vitest';

import i18next from '../../../i18n/index.js';

describe('server i18n initialization', () => {
  it('loads filesystem translations before callers can translate', () => {
    expect(i18next.isInitialized).toBe(true);
    expect(i18next.t('server:verification.passwordResetSent')).toBe(
      'If an account exists with that email, a password reset link has been sent'
    );
  });
});
