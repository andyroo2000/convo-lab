import i18next from './index.js';

interface BaseEmailOptions {
  locale: string;
  name: string;
}

function getBaseStyles() {
  return {
    direction: 'ltr',
    textAlign: 'left',
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
  const styles = getBaseStyles();

  return `
    <!DOCTYPE html>
    <html dir="${styles.direction}" lang="${locale}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: ${styles.fontFamily}; direction: ${styles.direction}; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
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

export function generateWelcomeEmail(options: BaseEmailOptions & { appUrl: string }): string {
  const { locale, name, appUrl } = options;
  const t = i18next.getFixedT(locale, 'email');
  const styles = getBaseStyles();

  return `
    <!DOCTYPE html>
    <html dir="${styles.direction}" lang="${locale}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: ${styles.fontFamily}; direction: ${styles.direction}; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${t('welcome.title')}</h1>
        </div>

        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin-top: 0; text-align: ${styles.textAlign};">${t('welcome.greeting', { name: escapeHtml(name) })}</p>
          <p style="font-size: 16px; text-align: ${styles.textAlign};">${t('welcome.body')}</p>

          <h2 style="font-size: 18px; margin-top: 25px; text-align: ${styles.textAlign};">${t('welcome.whatYouCanCreate')}</h2>

          <ul style="text-align: ${styles.textAlign}; padding-left: 20px;">
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
  const styles = getBaseStyles();

  return `
    <!DOCTYPE html>
    <html dir="${styles.direction}" lang="${locale}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: ${styles.fontFamily}; direction: ${styles.direction}; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${t('passwordChanged.title')}</h1>
        </div>

        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin-top: 0; text-align: ${styles.textAlign};">${t('passwordChanged.greeting', { name: escapeHtml(name) })}</p>
          <p style="font-size: 16px; text-align: ${styles.textAlign};">${t('passwordChanged.body')}</p>
          <p style="font-size: 16px; text-align: ${styles.textAlign};">${t('passwordChanged.ifYou')}</p>

          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; text-align: ${styles.textAlign};">
            <p style="margin: 0; font-size: 16px;"><strong>${t('passwordChanged.warningTitle')}</strong></p>
            <p style="margin: 10px 0 0; font-size: 14px;">${t('passwordChanged.warningBody', { email: supportEmail })}</p>
          </div>

          <p style="font-size: 14px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: ${styles.textAlign};">${t('passwordChanged.footer')}</p>
        </div>
      </body>
    </html>
  `;
}
