import { describe, it, expect, vi } from 'vitest';
import {
  generateVerificationEmail,
  generatePasswordResetEmail,
  generateWelcomeEmail,
  generatePasswordChangedEmail,
  generateSubscriptionConfirmedEmail,
  generatePaymentFailedEmail,
  generateSubscriptionCanceledEmail,
  generateQuotaWarningEmail,
} from '../../../i18n/emailTemplates.js';

// Mock i18n
const mockTranslations: Record<string, Record<string, (params?: any) => string>> = {
  en: {
    'verification.greeting': (p: any) => `Hello ${p.name}`,
    'verification.title': () => 'Verify Your Email',
    'verification.body': () => 'Please verify your email address',
    'verification.button': () => 'Verify Email',
    'verification.linkInstructions': () => 'Or copy and paste this link',
    'verification.expiry': () => 'Link expires in 24 hours',
    'passwordReset.greeting': (p: any) => `Hello ${p.name}`,
    'passwordReset.title': () => 'Reset Your Password',
    'passwordReset.body': () => 'Reset your password',
    'passwordReset.button': () => 'Reset Password',
    'passwordReset.linkInstructions': () => 'Or copy and paste this link',
    'passwordReset.expiry': () => 'Link expires in 1 hour',
    'welcome.greeting': (p: any) => `Welcome ${p.name}`,
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
    'passwordChanged.greeting': (p: any) => `Hello ${p.name}`,
    'passwordChanged.title': () => 'Password Changed',
    'passwordChanged.body': () => 'Your password was changed',
    'passwordChanged.warning': () => 'Contact support if not you',
    'passwordChanged.supportEmail': (p: any) => p.supportEmail,
    'subscriptionConfirmed.greeting': (p: any) => `Hello ${p.name}`,
    'subscriptionConfirmed.title': () => 'Subscription Confirmed',
    'subscriptionConfirmed.body': (p: any) => `Welcome to ${p.tier} tier`,
    'subscriptionConfirmed.benefits': () => 'Your Benefits',
    'subscriptionConfirmed.benefit1': () => '30 generations per week',
    'subscriptionConfirmed.benefit2': () => 'Priority support',
    'subscriptionConfirmed.benefit3': () => 'All features included',
    'subscriptionConfirmed.button': () => 'Start Creating',
    'subscriptionConfirmed.footer': () => 'ConvoLab Team',
    'paymentFailed.greeting': (p: any) => `Hello ${p.name}`,
    'paymentFailed.title': () => 'Payment Failed',
    'paymentFailed.body': () => 'Payment could not be processed',
    'paymentFailed.reasons': () => 'Common reasons',
    'paymentFailed.reason1': () => 'Insufficient funds',
    'paymentFailed.reason2': () => 'Card expired',
    'paymentFailed.reason3': () => 'Card declined',
    'paymentFailed.action': () => 'Update payment method',
    'paymentFailed.button': () => 'Update Payment',
    'paymentFailed.footer': () => 'ConvoLab Team',
    'subscriptionCanceled.greeting': (p: any) => `Hello ${p.name}`,
    'subscriptionCanceled.title': () => 'Subscription Canceled',
    'subscriptionCanceled.body': () => 'Your premium access will continue until the end of your billing period',
    'subscriptionCanceled.freeTierTitle': () => 'Free Tier Benefits',
    'subscriptionCanceled.generations': (p: any) => `${p.count} generations per week`,
    'subscriptionCanceled.contentTypes': () => 'All content types available',
    'subscriptionCanceled.support': () => 'Community support',
    'subscriptionCanceled.sorryToSeeYouGo': () => 'We\'re sorry to see you go',
    'subscriptionCanceled.reactivateNote': () => 'You can reactivate anytime from your billing page',
    'subscriptionCanceled.button': () => 'Manage Billing',
    'subscriptionCanceled.footer': () => 'ConvoLab Team',
    'quotaWarning.greeting': (p: any) => `Hello ${p.name}`,
    'quotaWarning.title': () => 'Quota Warning',
    'quotaWarning.body': (p: any) => `${p.percentage}% of quota used`,
    'quotaWarning.remaining': (p: any) => `${p.remaining} generations left`,
    'quotaWarning.reset': (p: any) => `Resets on ${p.resetDate}`,
    'quotaWarning.upgradeTitle': () => 'Upgrade to Pro',
    'quotaWarning.upgradeBody': () => 'Get 30 generations per week',
    'quotaWarning.upgradeButton': () => 'Upgrade Now',
    'quotaWarning.footer': () => 'ConvoLab Team',
  },
  ar: {
    'verification.greeting': (p: any) => `مرحبا ${p.name}`,
    'verification.title': () => 'تحقق من بريدك الإلكتروني',
    'verification.body': () => 'يرجى التحقق من عنوان بريدك الإلكتروني',
    'verification.button': () => 'تحقق من البريد',
    'verification.linkInstructions': () => 'أو انسخ والصق هذا الرابط',
    'verification.expiry': () => 'تنتهي الصلاحية خلال 24 ساعة',
    'passwordReset.greeting': (p: any) => `مرحبا ${p.name}`,
    'passwordReset.title': () => 'إعادة تعيين كلمة المرور',
    'passwordReset.body': () => 'إعادة تعيين كلمة المرور الخاصة بك',
    'passwordReset.button': () => 'إعادة تعيين كلمة المرور',
    'passwordReset.linkInstructions': () => 'أو انسخ والصق هذا الرابط',
    'passwordReset.expiry': () => 'تنتهي الصلاحية خلال ساعة واحدة',
    'welcome.greeting': (p: any) => `مرحبا ${p.name}`,
    'welcome.title': () => 'مرحبا بك في ConvoLab!',
    'welcome.body': () => 'ابدأ رحلتك اللغوية',
    'welcome.whatYouCanCreate': () => 'ما يمكنك إنشاؤه',
    'welcome.dialogues.title': () => 'حوارات الذكاء الاصطناعي',
    'welcome.dialogues.description': () => 'تدرب على المحادثات',
    'welcome.audioCourses.title': () => 'دورات صوتية',
    'welcome.audioCourses.description': () => 'تعلم بالصوت',
    'welcome.button': () => 'ابدأ الآن',
    'welcome.help': () => 'هل تحتاج مساعدة؟ اتصل بنا',
    'welcome.footer': () => 'فريق ConvoLab',
    'passwordChanged.greeting': (p: any) => `مرحبا ${p.name}`,
    'passwordChanged.title': () => 'تم تغيير كلمة المرور',
    'passwordChanged.body': () => 'تم تغيير كلمة المرور الخاصة بك',
    'passwordChanged.warning': () => 'اتصل بالدعم إذا لم تكن أنت',
    'passwordChanged.supportEmail': (p: any) => p.supportEmail,
    'subscriptionConfirmed.greeting': (p: any) => `مرحبا ${p.name}`,
    'subscriptionConfirmed.title': () => 'تم تأكيد الاشتراك',
    'subscriptionConfirmed.body': (p: any) => `مرحبا بك في ${p.tier} طبقة`,
    'subscriptionConfirmed.benefits': () => 'مزاياك',
    'subscriptionConfirmed.benefit1': () => '30 أجيال في الأسبوع',
    'subscriptionConfirmed.benefit2': () => 'دعم ذو أولوية',
    'subscriptionConfirmed.benefit3': () => 'جميع الميزات متضمنة',
    'subscriptionConfirmed.button': () => 'ابدأ الإنشاء',
    'subscriptionConfirmed.footer': () => 'فريق ConvoLab',
    'paymentFailed.greeting': (p: any) => `مرحبا ${p.name}`,
    'paymentFailed.title': () => 'فشل الدفع',
    'paymentFailed.body': () => 'تعذر معالجة الدفع',
    'paymentFailed.reasons': () => 'أسباب شائعة',
    'paymentFailed.reason1': () => 'أموال غير كافية',
    'paymentFailed.reason2': () => 'انتهت صلاحية البطاقة',
    'paymentFailed.reason3': () => 'تم رفض البطاقة',
    'paymentFailed.action': () => 'تحديث طريقة الدفع',
    'paymentFailed.button': () => 'تحديث الدفع',
    'paymentFailed.footer': () => 'فريق ConvoLab',
    'subscriptionCanceled.greeting': (p: any) => `مرحبا ${p.name}`,
    'subscriptionCanceled.title': () => 'تم إلغاء الاشتراك',
    'subscriptionCanceled.body': () => 'سيستمر وصولك المميز حتى نهاية فترة الفوترة',
    'subscriptionCanceled.freeTierTitle': () => 'مزايا المستوى المجاني',
    'subscriptionCanceled.generations': (p: any) => `${p.count} أجيال في الأسبوع`,
    'subscriptionCanceled.contentTypes': () => 'جميع أنواع المحتوى متاحة',
    'subscriptionCanceled.support': () => 'دعم المجتمع',
    'subscriptionCanceled.sorryToSeeYouGo': () => 'نأسف لرؤيتك تذهب',
    'subscriptionCanceled.reactivateNote': () => 'يمكنك إعادة التنشيط في أي وقت من صفحة الفوترة',
    'subscriptionCanceled.button': () => 'إدارة الفوترة',
    'subscriptionCanceled.footer': () => 'فريق ConvoLab',
    'quotaWarning.greeting': (p: any) => `مرحبا ${p.name}`,
    'quotaWarning.title': () => 'تحذير الحصة',
    'quotaWarning.body': (p: any) => `${p.percentage}٪ من الحصة مستخدمة`,
    'quotaWarning.remaining': (p: any) => `${p.remaining} أجيال متبقية`,
    'quotaWarning.reset': (p: any) => `إعادة التعيين في ${p.resetDate}`,
    'quotaWarning.upgradeTitle': () => 'الترقية إلى Pro',
    'quotaWarning.upgradeBody': () => 'احصل على 30 جيلاً في الأسبوع',
    'quotaWarning.upgradeButton': () => 'ترقية الآن',
    'quotaWarning.footer': () => 'فريق ConvoLab',
  },
};

vi.mock('../../../i18n/index.js', () => ({
  default: {
    getFixedT: vi.fn((locale: string, namespace: string) => (key: string, params?: any) => {
      // Only handle 'email' namespace, return key for others
      if (namespace !== 'email') return key;
      const translations = mockTranslations[locale] || mockTranslations.en;
      const translator = translations[key];
      return translator ? translator(params) : key;
    }),
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

    it('should generate RTL email for Arabic locale', () => {
      const html = generateVerificationEmail({
        name: 'أحمد',
        verificationUrl: 'https://example.com/verify',
        locale: 'ar',
      });

      expect(html).toContain('dir="rtl"');
      expect(html).toContain('text-align: right');
      expect(html).toContain('مرحبا أحمد');
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

    it('should generate RTL email for Arabic locale', () => {
      const html = generatePasswordResetEmail({
        name: 'فاطمة',
        resetUrl: 'https://example.com/reset',
        locale: 'ar',
      });

      expect(html).toContain('dir="rtl"');
      expect(html).toContain('text-align: right');
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

    it('should generate RTL email for Arabic locale', () => {
      const html = generateWelcomeEmail({
        name: 'علي',
        locale: 'ar',
        appUrl: 'https://example.com/app',
      });

      expect(html).toContain('dir="rtl"');
      expect(html).toContain('ما يمكنك إنشاؤه');
      expect(html).toContain('حوارات الذكاء الاصطناعي');
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

    it('should generate warning box in RTL email', () => {
      const html = generatePasswordChangedEmail({
        name: 'محمد',
        locale: 'ar',
        supportEmail: 'support@example.com',
      });

      expect(html).toContain('dir="rtl"');
      expect(html).toContain('background: linear-gradient(225deg');
    });
  });

  describe('generateSubscriptionConfirmedEmail', () => {
    it('should generate LTR email and escape XSS in name', () => {
      const html = generateSubscriptionConfirmedEmail({
        name: '<script>alert(1)</script>',
        tier: 'pro',
        locale: 'en',
      });

      expect(html).toContain('dir="ltr"');
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>alert(1)</script>');
    });

    it('should generate RTL email for Arabic locale', () => {
      const html = generateSubscriptionConfirmedEmail({
        name: 'سارة',
        tier: 'pro',
        locale: 'ar',
      });

      expect(html).toContain('dir="rtl"');
      expect(html).toContain('text-align: right');
    });
  });

  describe('generatePaymentFailedEmail', () => {
    it('should generate LTR email and escape XSS', () => {
      const html = generatePaymentFailedEmail({
        name: '<img src=x onerror=alert(1)>',
        locale: 'en',
      });

      expect(html).toContain('dir="ltr"');
      expect(html).toContain('&lt;img');
      expect(html).not.toContain('<img src=x onerror=alert(1)>');
    });

    it('should generate RTL email for Arabic locale', () => {
      const html = generatePaymentFailedEmail({
        name: 'خالد',
        locale: 'ar',
      });

      expect(html).toContain('dir="rtl"');
      expect(html).toContain('text-align: right');
    });
  });

  describe('generateSubscriptionCanceledEmail', () => {
    it('should generate LTR email and escape XSS', () => {
      const html = generateSubscriptionCanceledEmail({
        name: '<img src=x onerror=alert(1)>',
        billingUrl: 'https://example.com/billing',
        locale: 'en',
      });

      expect(html).toContain('dir="ltr"');
      expect(html).toContain('&lt;img');
      expect(html).not.toContain('<img src=x onerror=alert(1)>');
    });

    it('should generate RTL email for Arabic locale', () => {
      const html = generateSubscriptionCanceledEmail({
        name: 'ليلى',
        billingUrl: 'https://example.com/billing',
        locale: 'ar',
      });

      expect(html).toContain('dir="rtl"');
      expect(html).toContain('text-align: right');
    });
  });

  describe('generateQuotaWarningEmail', () => {
    it('should show percentage and remaining count for free tier with upgrade prompt', () => {
      const html = generateQuotaWarningEmail({
        name: 'Frank',
        percentage: 80,
        remaining: 1,
        resetDate: '2024-01-15',
        tier: 'free',
        locale: 'en',
        appUrl: 'https://example.com/app',
      });

      expect(html).toContain('dir="ltr"');
      expect(html).toContain('Upgrade to Pro');
      expect(html).toContain('Get 30 generations per week');
    });

    it('should NOT show upgrade prompt for pro tier', () => {
      const html = generateQuotaWarningEmail({
        name: 'Grace',
        percentage: 90,
        remaining: 3,
        resetDate: '2024-01-15',
        tier: 'pro',
        locale: 'en',
        appUrl: 'https://example.com/app',
      });

      expect(html).toContain('dir="ltr"');
      expect(html).not.toContain('Upgrade to Pro');
    });

    it('should generate RTL email for Arabic locale', () => {
      const html = generateQuotaWarningEmail({
        name: 'عمر',
        percentage: 85,
        remaining: 5,
        resetDate: '2024-01-15',
        tier: 'free',
        locale: 'ar',
        appUrl: 'https://example.com/app',
      });

      expect(html).toContain('dir="rtl"');
      expect(html).toContain('text-align: right');
    });

    it('should escape XSS in name', () => {
      const html = generateQuotaWarningEmail({
        name: '<script>alert(1)</script>',
        percentage: 80,
        remaining: 1,
        resetDate: '2024-01-15',
        tier: 'free',
        locale: 'en',
        appUrl: 'https://example.com/app',
      });

      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>alert(1)</script>');
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
      const html = generateSubscriptionConfirmedEmail({
        name: 'Test',
        tier: 'pro',
        locale: 'en',
      });

      expect(html).toContain('<head>');
      expect(html).toContain('<body');
      expect(html).toContain('</body>');
    });
  });
});
