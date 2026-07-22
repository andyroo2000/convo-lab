/* eslint-disable no-console */
import { Resend } from 'resend';

import { prisma } from '../db/client.js';
import { generatePasswordChangedEmail } from '../i18n/emailTemplates.js';
import i18next from '../i18n/index.js';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

if (!resend) {
  console.warn('⚠️  RESEND_API_KEY not configured - email functionality will be disabled');
}

const FROM_EMAIL = process.env.EMAIL_FROM || 'ConvoLab <noreply@convolab.app>';
const REPLY_TO_EMAIL = process.env.EMAIL_REPLY_TO || 'support@convolab.app';

// Helper to get user's preferred language by email
async function getUserLocaleByEmail(email: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { preferredNativeLanguage: true },
  });
  return user?.preferredNativeLanguage || 'en';
}

/**
 * Send a confirmation email after password change
 */
export async function sendPasswordChangedEmail(email: string, name: string): Promise<void> {
  try {
    if (!resend) return; // Skip email sending if Resend not configured

    // Get user's preferred language
    const locale = await getUserLocaleByEmail(email);
    const t = i18next.getFixedT(locale, 'email');

    const html = generatePasswordChangedEmail({ locale, name, supportEmail: REPLY_TO_EMAIL });
    const subject = t('passwordChanged.subject');

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      replyTo: REPLY_TO_EMAIL,
      subject,
      html,
    });

    console.log(`✓ Password changed email sent to ${email} (${locale})`);
  } catch (error) {
    console.error('Error sending password changed email:', error);
    // Don't throw - notification email is nice to have but not critical
  }
}
