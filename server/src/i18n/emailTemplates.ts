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
