import i18next from './index.js';

interface BaseEmailOptions {
  locale: string;
  name: string;
}

function getBaseStyles(isRTL: boolean) {
  return {
    direction: isRTL ? 'rtl' : 'ltr',
    textAlign: isRTL ? 'right' : 'left',
    fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`,
  };
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateVerificationEmail(
  options: BaseEmailOptions & { verificationUrl: string }
): string {
  const { locale, name, verificationUrl } = options;
  const t = i18next.getFixedT(locale, 'email');
  const isRTL = locale === 'ar';
  const styles = getBaseStyles(isRTL);

  return `
    <!DOCTYPE html>
    <html dir="${styles.direction}" lang="${locale}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: ${styles.fontFamily}; direction: ${styles.direction}; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(${isRTL ? '225deg' : '135deg'}, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${t('verification.title')}</h1>
        </div>

        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin-top: 0; text-align: ${styles.textAlign};">${t('verification.greeting', { name: escapeHtml(name) })}</p>
          <p style="font-size: 16px; text-align: ${styles.textAlign};">${t('verification.body')}</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px;">${t('verification.button')}</a>
          </div>

          <p style="font-size: 14px; color: #666; text-align: ${styles.textAlign};">${t('verification.linkInstructions')}</p>
          <p style="font-size: 14px; color: #667eea; word-break: break-all; text-align: ${styles.textAlign};">${verificationUrl}</p>

          <p style="font-size: 14px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: ${styles.textAlign};">${t('verification.expiry')}</p>
        </div>
      </body>
    </html>
  `;
}

export function generatePasswordResetEmail(
  options: BaseEmailOptions & { resetUrl: string }
): string {
  const { locale, name, resetUrl } = options;
  const t = i18next.getFixedT(locale, 'email');
  const isRTL = locale === 'ar';
  const styles = getBaseStyles(isRTL);

  return `
    <!DOCTYPE html>
    <html dir="${styles.direction}" lang="${locale}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: ${styles.fontFamily}; direction: ${styles.direction}; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(${isRTL ? '225deg' : '135deg'}, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${t('passwordReset.title')}</h1>
        </div>

        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin-top: 0; text-align: ${styles.textAlign};">${t('passwordReset.greeting', { name: escapeHtml(name) })}</p>
          <p style="font-size: 16px; text-align: ${styles.textAlign};">${t('passwordReset.body')}</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px;">${t('passwordReset.button')}</a>
          </div>

          <p style="font-size: 14px; color: #666; text-align: ${styles.textAlign};">${t('passwordReset.linkInstructions')}</p>
          <p style="font-size: 14px; color: #667eea; word-break: break-all; text-align: ${styles.textAlign};">${resetUrl}</p>

          <p style="font-size: 14px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: ${styles.textAlign};">${t('passwordReset.expiry')}</p>
        </div>
      </body>
    </html>
  `;
}

export function generateWelcomeEmail(options: BaseEmailOptions & { appUrl: string }): string {
  const { locale, name, appUrl } = options;
  const t = i18next.getFixedT(locale, 'email');
  const isRTL = locale === 'ar';
  const styles = getBaseStyles(isRTL);

  return `
    <!DOCTYPE html>
    <html dir="${styles.direction}" lang="${locale}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: ${styles.fontFamily}; direction: ${styles.direction}; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(${isRTL ? '225deg' : '135deg'}, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${t('welcome.title')}</h1>
        </div>

        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin-top: 0; text-align: ${styles.textAlign};">${t('welcome.greeting', { name: escapeHtml(name) })}</p>
          <p style="font-size: 16px; text-align: ${styles.textAlign};">${t('welcome.body')}</p>

          <h2 style="font-size: 18px; margin-top: 25px; text-align: ${styles.textAlign};">${t('welcome.whatYouCanCreate')}</h2>

          <ul style="text-align: ${styles.textAlign}; padding-${isRTL ? 'right' : 'left'}: 20px;">
            <li style="margin-bottom: 10px;"><strong>${t('welcome.dialogues.title')}</strong> ${t('welcome.dialogues.description')}</li>
            <li style="margin-bottom: 10px;"><strong>${t('welcome.audioCourses.title')}</strong> ${t('welcome.audioCourses.description')}</li>
          </ul>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${appUrl}" style="background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px;">${t('welcome.button')}</a>
          </div>

          <p style="font-size: 14px; color: #666; text-align: ${styles.textAlign};">${t('welcome.help')}</p>

          <p style="font-size: 14px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: ${styles.textAlign};">${t('welcome.footer')}</p>
        </div>
      </body>
    </html>
  `;
}

export function generatePasswordChangedEmail(
  options: BaseEmailOptions & { supportEmail: string }
): string {
  const { locale, name, supportEmail } = options;
  const t = i18next.getFixedT(locale, 'email');
  const isRTL = locale === 'ar';
  const styles = getBaseStyles(isRTL);

  return `
    <!DOCTYPE html>
    <html dir="${styles.direction}" lang="${locale}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: ${styles.fontFamily}; direction: ${styles.direction}; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(${isRTL ? '225deg' : '135deg'}, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${t('passwordChanged.title')}</h1>
        </div>

        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin-top: 0; text-align: ${styles.textAlign};">${t('passwordChanged.greeting', { name: escapeHtml(name) })}</p>
          <p style="font-size: 16px; text-align: ${styles.textAlign};">${t('passwordChanged.body')}</p>
          <p style="font-size: 16px; text-align: ${styles.textAlign};">${t('passwordChanged.ifYou')}</p>

          <div style="background: #fff3cd; border-${isRTL ? 'right' : 'left'}: 4px solid #ffc107; padding: 15px; margin: 20px 0; text-align: ${styles.textAlign};">
            <p style="margin: 0; font-size: 16px;"><strong>${t('passwordChanged.warningTitle')}</strong></p>
            <p style="margin: 10px 0 0; font-size: 14px;">${t('passwordChanged.warningBody', { email: supportEmail })}</p>
          </div>

          <p style="font-size: 14px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: ${styles.textAlign};">${t('passwordChanged.footer')}</p>
        </div>
      </body>
    </html>
  `;
}

export function generateSubscriptionConfirmedEmail(
  options: BaseEmailOptions & { tier: string; weeklyLimit: number; appUrl: string }
): string {
  const { locale, name, tier, weeklyLimit, appUrl } = options;
  const t = i18next.getFixedT(locale, 'email');
  const isRTL = locale === 'ar';
  const styles = getBaseStyles(isRTL);
  const tierDisplay = tier.charAt(0).toUpperCase() + tier.slice(1);

  return `
    <!DOCTYPE html>
    <html dir="${styles.direction}" lang="${locale}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: ${styles.fontFamily}; direction: ${styles.direction}; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(${isRTL ? '225deg' : '135deg'}, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${t('subscriptionConfirmed.title', { tier: tierDisplay })}</h1>
        </div>

        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin-top: 0; text-align: ${styles.textAlign};">${t('subscriptionConfirmed.greeting', { name: escapeHtml(name) })}</p>
          <p style="font-size: 16px; text-align: ${styles.textAlign};">${t('subscriptionConfirmed.body', { tier: tierDisplay })}</p>

          <h2 style="font-size: 18px; margin-top: 25px; text-align: ${styles.textAlign};">${t('subscriptionConfirmed.benefitsTitle', { tier: tierDisplay })}</h2>

          <ul style="text-align: ${styles.textAlign}; padding-${isRTL ? 'right' : 'left'}: 20px;">
            <li style="margin-bottom: 10px;">${t('subscriptionConfirmed.generations', { count: weeklyLimit })}</li>
            <li style="margin-bottom: 10px;">${t('subscriptionConfirmed.contentTypes')}</li>
            <li style="margin-bottom: 10px;">${t('subscriptionConfirmed.tts')}</li>
            <li style="margin-bottom: 10px;">${t('subscriptionConfirmed.support')}</li>
          </ul>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${appUrl}" style="background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px;">${t('subscriptionConfirmed.button')}</a>
          </div>

          <p style="font-size: 14px; color: #666; text-align: ${styles.textAlign};">${t('subscriptionConfirmed.manage')}</p>

          <p style="font-size: 14px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: ${styles.textAlign};">${t('subscriptionConfirmed.footer')}</p>
        </div>
      </body>
    </html>
  `;
}

export function generatePaymentFailedEmail(
  options: BaseEmailOptions & { billingUrl: string; supportEmail: string }
): string {
  const { locale, name, billingUrl, supportEmail } = options;
  const t = i18next.getFixedT(locale, 'email');
  const isRTL = locale === 'ar';
  const styles = getBaseStyles(isRTL);

  return `
    <!DOCTYPE html>
    <html dir="${styles.direction}" lang="${locale}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: ${styles.fontFamily}; direction: ${styles.direction}; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(${isRTL ? '225deg' : '135deg'}, #dc3545 0%, #c82333 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${t('paymentFailed.title')}</h1>
        </div>

        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin-top: 0; text-align: ${styles.textAlign};">${t('paymentFailed.greeting', { name: escapeHtml(name) })}</p>
          <p style="font-size: 16px; text-align: ${styles.textAlign};">${t('paymentFailed.body')}</p>

          <ul style="text-align: ${styles.textAlign}; padding-${isRTL ? 'right' : 'left'}: 20px;">
            <li>${t('paymentFailed.reasonFunds')}</li>
            <li>${t('paymentFailed.reasonExpired')}</li>
            <li>${t('paymentFailed.reasonVerification')}</li>
          </ul>

          <div style="background: #f8d7da; border-${isRTL ? 'right' : 'left'}: 4px solid #dc3545; padding: 15px; margin: 20px 0; text-align: ${styles.textAlign};">
            <p style="margin: 0; font-size: 16px;"><strong>${t('paymentFailed.warningTitle')}</strong></p>
            <p style="margin: 10px 0 0; font-size: 14px;">${t('paymentFailed.warningBody')}</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${billingUrl}" style="background: #dc3545; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px;">${t('paymentFailed.button')}</a>
          </div>

          <p style="font-size: 14px; color: #666; text-align: ${styles.textAlign};">${t('paymentFailed.help', { email: supportEmail })}</p>

          <p style="font-size: 14px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: ${styles.textAlign};">${t('paymentFailed.footer')}</p>
        </div>
      </body>
    </html>
  `;
}

export function generateSubscriptionCanceledEmail(
  options: BaseEmailOptions & { billingUrl: string }
): string {
  const { locale, name, billingUrl } = options;
  const t = i18next.getFixedT(locale, 'email');
  const isRTL = locale === 'ar';
  const styles = getBaseStyles(isRTL);

  return `
    <!DOCTYPE html>
    <html dir="${styles.direction}" lang="${locale}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: ${styles.fontFamily}; direction: ${styles.direction}; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(${isRTL ? '225deg' : '135deg'}, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${t('subscriptionCanceled.title')}</h1>
        </div>

        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin-top: 0; text-align: ${styles.textAlign};">${t('subscriptionCanceled.greeting', { name: escapeHtml(name) })}</p>
          <p style="font-size: 16px; text-align: ${styles.textAlign};">${t('subscriptionCanceled.body')}</p>

          <h2 style="font-size: 18px; margin-top: 25px; text-align: ${styles.textAlign};">${t('subscriptionCanceled.freeTierTitle')}</h2>

          <ul style="text-align: ${styles.textAlign}; padding-${isRTL ? 'right' : 'left'}: 20px;">
            <li style="margin-bottom: 10px;">${t('subscriptionCanceled.generations', { count: 5 })}</li>
            <li style="margin-bottom: 10px;">${t('subscriptionCanceled.contentTypes')}</li>
            <li style="margin-bottom: 10px;">${t('subscriptionCanceled.support')}</li>
          </ul>

          <p style="font-size: 16px; text-align: ${styles.textAlign};">${t('subscriptionCanceled.sorryToSeeYouGo')}</p>
          <p style="font-size: 16px; text-align: ${styles.textAlign};">${t('subscriptionCanceled.reactivateNote')}</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${billingUrl}" style="background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px;">${t('subscriptionCanceled.button')}</a>
          </div>

          <p style="font-size: 14px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: ${styles.textAlign};">${t('subscriptionCanceled.footer')}</p>
        </div>
      </body>
    </html>
  `;
}

export function generateQuotaWarningEmail(
  options: BaseEmailOptions & {
    used: number;
    limit: number;
    percentage: number;
    tier: string;
    pricingUrl: string;
  }
): string {
  const { locale, name, used, limit, percentage, tier, pricingUrl } = options;
  const t = i18next.getFixedT(locale, 'email');
  const isRTL = locale === 'ar';
  const styles = getBaseStyles(isRTL);
  const remaining = limit - used;

  return `
    <!DOCTYPE html>
    <html dir="${styles.direction}" lang="${locale}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: ${styles.fontFamily}; direction: ${styles.direction}; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(${isRTL ? '225deg' : '135deg'}, #ffc107 0%, #ff9800 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${t('quotaWarning.title')}</h1>
        </div>

        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin-top: 0; text-align: ${styles.textAlign};">${t('quotaWarning.greeting', { name: escapeHtml(name) })}</p>
          <p style="font-size: 16px; text-align: ${styles.textAlign};">${t('quotaWarning.body', { used, limit, percentage })}</p>

          <div style="background: #fff; border: 2px solid #ffc107; padding: 20px; margin: 20px 0; text-align: ${styles.textAlign};">
            <h2 style="font-size: 18px; margin-top: 0;">${t('quotaWarning.usageTitle')}</h2>
            <p style="font-size: 24px; font-weight: bold; color: #ffc107; margin: 10px 0;">${remaining > 1 ? t('quotaWarning.remaining_plural', { count: remaining }) : t('quotaWarning.remaining', { count: remaining })}</p>
            <p style="font-size: 14px; color: #666; margin-bottom: 0;">${t('quotaWarning.quotaReset')}</p>
          </div>

          ${
            tier === 'free'
              ? `
          <div style="background: #e7f3ff; border-${isRTL ? 'right' : 'left'}: 4px solid #667eea; padding: 15px; margin: 20px 0; text-align: ${styles.textAlign};">
            <p style="margin: 0; font-size: 16px;"><strong>${t('quotaWarning.upgradeTitle')}</strong></p>
            <p style="margin: 10px 0 0; font-size: 14px;">${t('quotaWarning.upgradeBody', { count: 30 })}</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${pricingUrl}" style="background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px;">${t('quotaWarning.button')}</a>
          </div>
          `
              : ''
          }

          <p style="font-size: 14px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: ${styles.textAlign};">${t('quotaWarning.footer')}</p>
        </div>
      </body>
    </html>
  `;
}
