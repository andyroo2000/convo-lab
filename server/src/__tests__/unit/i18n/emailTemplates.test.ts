import { describe, expect, it, vi } from 'vitest';

import { generatePasswordChangedEmail } from '../../../i18n/emailTemplates.js';

vi.mock('../../../i18n/index.js', () => ({
  default: {
    getFixedT: vi.fn(() => (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'passwordChanged.greeting': `Hello ${params?.name ?? ''}`,
        'passwordChanged.title': 'Password Changed',
        'passwordChanged.body': 'Your password was changed',
        'passwordChanged.ifYou': 'If this was not you, contact support.',
        'passwordChanged.warningTitle': 'Security warning',
        'passwordChanged.warningBody': `Contact ${params?.email ?? ''}`,
        'passwordChanged.footer': 'ConvoLab Team',
      };
      return translations[key] ?? key;
    }),
  },
}));

describe('generatePasswordChangedEmail', () => {
  it('escapes user-controlled names', () => {
    const html = generatePasswordChangedEmail({
      name: '<script>alert("XSS")</script>',
      locale: 'en',
      supportEmail: 'support@example.com',
    });

    expect(html).toContain('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert("XSS")</script>');
  });

  it('renders a responsive LTR notification with support contact', () => {
    const html = generatePasswordChangedEmail({
      name: 'Bob',
      locale: 'en',
      supportEmail: 'support@example.com',
    });

    expect(html.trim()).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('dir="ltr"');
    expect(html).toContain('<meta name="viewport"');
    expect(html).toContain('Hello Bob');
    expect(html).toContain('support@example.com');
    expect(html).toContain('</html>');
  });
});
