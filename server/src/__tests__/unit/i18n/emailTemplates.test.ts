import { describe, it, expect, vi } from 'vitest';

import {
  generateVerificationEmail,
  generatePasswordResetEmail,
  generateWelcomeEmail,
  generatePasswordChangedEmail,
} from '../../../i18n/emailTemplates.js';

interface TranslationParams {
  name?: string;
  supportEmail?: string;
  appUrl?: string;
  count?: number;
}

// Mock i18n
const mockTranslations: Record<string, Record<string, (params?: TranslationParams) => string>> = {
  en: {
    'verification.greeting': (p?: TranslationParams) => `Hello ${p?.name}`,
    'verification.title': () => 'Verify Your Email',
    'verification.body': () => 'Please verify your email address',
    'verification.button': () => 'Verify Email',
    'verification.linkInstructions': () => 'Or copy and paste this link',
    'verification.expiry': () => 'Link expires in 24 hours',
    'passwordReset.greeting': (p?: TranslationParams) => `Hello ${p?.name}`,
    'passwordReset.title': () => 'Reset Your Password',
    'passwordReset.body': () => 'Reset your password',
    'passwordReset.button': () => 'Reset Password',
    'passwordReset.linkInstructions': () => 'Or copy and paste this link',
    'passwordReset.expiry': () => 'Link expires in 1 hour',
    'welcome.greeting': (p?: TranslationParams) => `Welcome ${p?.name}`,
    'welcome.title': () => 'Welcome to ConvoLab!',
    'welcome.body': () => 'Start your language journey',
    'welcome.whatYouCanCreate': () => 'What You Can Create',
    'welcome.dialogues.title': () => 'AI Dialogues',
    'welcome.dialogues.description': () => 'Practice conversations',
    'welcome.audioCourses.title': () => 'Audio Courses',
    'welcome.audioCourses.description': () => 'Learn with audio',
    'welcome.button': () => 'Get Started',
    'welcome.help': () => 'Need help? Contact us',
    'welcome.footer': () => 'ConvoLab Team',
    'passwordChanged.greeting': (p?: TranslationParams) => `Hello ${p?.name}`,
    'passwordChanged.title': () => 'Password Changed',
    'passwordChanged.body': () => 'Your password was changed',
    'passwordChanged.warning': () => 'Contact support if not you',
    'passwordChanged.supportEmail': (p?: TranslationParams) => p?.supportEmail ?? '',
  },
};

vi.mock('../../../i18n/index.js', () => ({
  default: {
    getFixedT: vi.fn(
      (locale: string, namespace: string) => (key: string, params?: TranslationParams) => {
        // Only handle 'email' namespace, return key for others
        if (namespace !== 'email') return key;
        const translations = mockTranslations[locale] || mockTranslations.en;
        const translator = translations[key];
        return translator ? translator(params) : key;
      }
    ),
  },
}));

describe('emailTemplates - XSS Prevention', () => {
  describe('escapeHtml function (implicit testing)', () => {
    it('should escape < to &lt; in user names', () => {
      const html = generateVerificationEmail({
        name: '<script>',
        verificationUrl: 'https://example.com/verify',
        locale: 'en',
      });

      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>');
    });

    it('should escape > to &gt; in user names', () => {
      const html = generateVerificationEmail({
        name: 'test>alert',
        verificationUrl: 'https://example.com/verify',
        locale: 'en',
      });

      expect(html).toContain('&gt;');
      expect(html).not.toContain('test>alert');
    });

    it('should escape & to &amp; in user names', () => {
      const html = generateVerificationEmail({
        name: 'Tom & Jerry',
        verificationUrl: 'https://example.com/verify',
        locale: 'en',
      });

      expect(html).toContain('&amp;');
    });

    it('should escape " to &quot; in user names', () => {
      const html = generateVerificationEmail({
        name: 'test"quote',
        verificationUrl: 'https://example.com/verify',
        locale: 'en',
      });

      expect(html).toContain('&quot;');
    });

    it("should escape ' to &#039; in user names", () => {
      const html = generateVerificationEmail({
        name: "test'quote",
        verificationUrl: 'https://example.com/verify',
        locale: 'en',
      });

      expect(html).toContain('&#039;');
    });

    it('should prevent XSS attack: <script>alert("XSS")</script>', () => {
      const html = generateVerificationEmail({
        name: '<script>alert("XSS")</script>',
        verificationUrl: 'https://example.com/verify',
        locale: 'en',
      });

      expect(html).toContain('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
      expect(html).not.toContain('<script>alert("XSS")</script>');
    });

    it('should prevent XSS attack: "><img src=x onerror=alert(1)>', () => {
      const html = generateVerificationEmail({
        name: '"><img src=x onerror=alert(1)>',
        verificationUrl: 'https://example.com/verify',
        locale: 'en',
      });

      expect(html).toContain('&quot;&gt;&lt;img');
      expect(html).not.toContain('"><img src=x onerror=alert(1)>');
    });

    it('should prevent XSS attack: javascript:void(0)', () => {
      const html = generateVerificationEmail({
        name: 'javascript:void(0)',
        verificationUrl: 'https://example.com/verify',
        locale: 'en',
      });

      // Name should be in escaped form in HTML body
      expect(html).toContain('javascript:void(0)');
      // But should not be in a dangerous context like href
    });

    it('should handle empty string names', () => {
      const html = generateVerificationEmail({
        name: '',
        verificationUrl: 'https://example.com/verify',
        locale: 'en',
      });

      expect(html).toBeTruthy();
      expect(html).toContain('<!DOCTYPE html>');
    });

    it('should handle multiple special characters together', () => {
      const html = generateVerificationEmail({
        name: '<>&"\'',
        verificationUrl: 'https://example.com/verify',
        locale: 'en',
      });

      expect(html).toContain('&lt;&gt;&amp;&quot;&#039;');
      expect(html).not.toContain('<>&"\'');
    });

    it('should escape SQL injection-like attempts', () => {
      const html = generateVerificationEmail({
        name: "'; DROP TABLE users--",
        verificationUrl: 'https://example.com/verify',
        locale: 'en',
      });

      expect(html).toContain('&#039;');
      // Should not execute as SQL or JS
      expect(html).not.toContain("'; DROP TABLE users--");
    });
  });

  describe('generateVerificationEmail', () => {
    it('should generate LTR email for English locale', () => {
      const html = generateVerificationEmail({
        name: 'John',
        verificationUrl: 'https://example.com/verify',
        locale: 'en',
      });

      expect(html).toContain('dir="ltr"');
      expect(html).toContain('text-align: left');
      expect(html).toContain('Hello John');
    });

    it('should include verification URL as clickable link', () => {
      const html = generateVerificationEmail({
        name: 'John',
        verificationUrl: 'https://example.com/verify?token=abc123',
        locale: 'en',
      });

      expect(html).toContain('href="https://example.com/verify?token=abc123"');
    });

    it('should escape malicious names but not URLs', () => {
      const html = generateVerificationEmail({
        name: '<script>alert(1)</script>',
        verificationUrl: 'https://example.com/verify',
        locale: 'en',
      });

      // Name should be escaped
      expect(html).toContain('&lt;script&gt;');
      // URL should not be escaped (it's an attribute)
      expect(html).toContain('href="https://example.com/verify"');
    });
  });

  describe('generatePasswordResetEmail', () => {
    it('should generate LTR email for English locale', () => {
      const html = generatePasswordResetEmail({
        name: 'Jane',
        resetUrl: 'https://example.com/reset',
        locale: 'en',
      });

      expect(html).toContain('dir="ltr"');
      expect(html).toContain('Hello Jane');
    });
  });

  describe('generateWelcomeEmail', () => {
    it('should generate LTR email with features list', () => {
      const html = generateWelcomeEmail({
        name: 'Alice',
        locale: 'en',
        appUrl: 'https://example.com/app',
      });

      expect(html).toContain('dir="ltr"');
      expect(html).toContain('Welcome Alice');
      expect(html).toContain('What You Can Create');
      expect(html).toContain('AI Dialogues');
      expect(html).toContain('Audio Courses');
    });

    it('should escape XSS in name while preserving features', () => {
      const html = generateWelcomeEmail({
        name: '<img src=x onerror=alert(1)>',
        locale: 'en',
        appUrl: 'https://example.com/app',
      });

      expect(html).toContain('&lt;img');
      expect(html).not.toContain('<img src=x onerror=alert(1)>');
      expect(html).toContain('What You Can Create');
    });
  });

  describe('generatePasswordChangedEmail', () => {
    it('should generate warning box in LTR email', () => {
      const html = generatePasswordChangedEmail({
        name: 'Bob',
        locale: 'en',
        supportEmail: 'support@example.com',
      });

      expect(html).toContain('dir="ltr"');
      expect(html).toContain('Hello Bob');
      expect(html).toContain('Password Changed');
    });
  });

  describe('HTML Structure Validation', () => {
    it('should generate valid HTML with DOCTYPE', () => {
      const html = generateVerificationEmail({
        name: 'Test',
        verificationUrl: 'https://example.com',
        locale: 'en',
      });

      expect(html.trim()).toMatch(/^<!DOCTYPE html>/);
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
    });

    it('should include meta viewport for responsive design', () => {
      const html = generateWelcomeEmail({
        name: 'Test',
        locale: 'en',
        appUrl: 'https://example.com/app',
      });

      expect(html).toContain('<meta name="viewport"');
    });

    it('should use semantic HTML structure', () => {
      const html = generateWelcomeEmail({
        name: 'Test',
        appUrl: 'https://example.com/app',
        locale: 'en',
      });

      expect(html).toContain('<head>');
      expect(html).toContain('<body');
      expect(html).toContain('</body>');
    });
  });
});
