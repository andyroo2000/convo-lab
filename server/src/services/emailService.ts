import { Resend } from 'resend';
import crypto from 'crypto';
import { prisma } from '../db/client.js';
import i18next from '../i18n/index.js';
import {
  generateVerificationEmail,
  generatePasswordResetEmail,
  generateWelcomeEmail,
  generatePasswordChangedEmail,
  generateSubscriptionConfirmedEmail,
  generatePaymentFailedEmail,
  generateSubscriptionCanceledEmail,
  generateQuotaWarningEmail,
} from '../i18n/emailTemplates.js';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

if (!resend) {
  console.warn('⚠️  RESEND_API_KEY not configured - email functionality will be disabled');
}

const FROM_EMAIL = process.env.EMAIL_FROM || 'ConvoLab <noreply@convolab.app>';
const REPLY_TO_EMAIL = process.env.EMAIL_REPLY_TO || 'support@convolab.app>';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Helper to get user's preferred language
async function getUserLocale(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferredNativeLanguage: true },
  });
  return user?.preferredNativeLanguage || 'en';
}

// Helper to get user's preferred language by email
async function getUserLocaleByEmail(email: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { preferredNativeLanguage: true },
  });
  return user?.preferredNativeLanguage || 'en';
}

// Generate a secure random token
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Generate a 6-digit verification code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Create an email verification token and send verification email
 */
export async function sendVerificationEmail(
  userId: string,
  email: string,
  name: string
): Promise<void> {
  // Delete any existing verification tokens for this user
  await prisma.emailVerificationToken.deleteMany({
    where: { userId },
  });

  // Generate token (expires in 24 hours)
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Create token in database
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  // Get user's preferred language
  const locale = await getUserLocale(userId);
  const t = i18next.getFixedT(locale, 'email');

  // Send email
  const verificationUrl = `${CLIENT_URL}/verify-email/${token}`;
  const html = generateVerificationEmail({ locale, name, verificationUrl });
  const subject = t('verification.subject');

  try {
    // In development, log the URL to console instead of sending email
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`✉️  EMAIL VERIFICATION (DEV MODE) [${locale}]`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`To: ${email}`);
      console.log(`Subject: ${subject}`);
      console.log(`\n🔗 Verification Link (expires in 24 hours):`);
      console.log(`   ${verificationUrl}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return;
    }

    if (!resend) return; // Skip email sending if Resend not configured

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      replyTo: REPLY_TO_EMAIL,
      subject,
      html,
    });

    console.log(`✓ Verification email sent to ${email} (${locale})`);
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error('Failed to send verification email');
  }
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail(
  userId: string,
  email: string,
  name: string
): Promise<void> {
  // Delete any existing password reset tokens for this user
  await prisma.passwordResetToken.deleteMany({
    where: { userId },
  });

  // Generate token (expires in 1 hour)
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  // Create token in database
  await prisma.passwordResetToken.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  // Get user's preferred language
  const locale = await getUserLocale(userId);
  const t = i18next.getFixedT(locale, 'email');

  // Send email
  const resetUrl = `${CLIENT_URL}/reset-password/${token}`;
  const html = generatePasswordResetEmail({ locale, name, resetUrl });
  const subject = t('passwordReset.subject');

  try {
    // In development, log the URL to console instead of sending email
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🔑 PASSWORD RESET (DEV MODE) [${locale}]`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`To: ${email}`);
      console.log(`Subject: ${subject}`);
      console.log(`\n🔗 Reset Link (expires in 1 hour):`);
      console.log(`   ${resetUrl}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return;
    }

    if (!resend) return; // Skip email sending if Resend not configured

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      replyTo: REPLY_TO_EMAIL,
      subject,
      html,
    });

    console.log(`✓ Password reset email sent to ${email} (${locale})`);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
}

/**
 * Send a welcome email after email verification
 */
export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  try {
    if (!resend) return; // Skip email sending if Resend not configured

    // Get user's preferred language
    const locale = await getUserLocaleByEmail(email);
    const t = i18next.getFixedT(locale, 'email');

    const html = generateWelcomeEmail({ locale, name, appUrl: CLIENT_URL });
    const subject = t('welcome.subject');

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      replyTo: REPLY_TO_EMAIL,
      subject,
      html,
    });

    console.log(`✓ Welcome email sent to ${email} (${locale})`);
  } catch (error) {
    console.error('Error sending welcome email:', error);
    // Don't throw - welcome email is nice to have but not critical
  }
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

/**
 * Verify an email verification token
 */
export async function verifyEmailToken(
  token: string
): Promise<{ userId: string; email: string } | null> {
  const tokenRecord = await prisma.emailVerificationToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!tokenRecord) {
    return null;
  }

  // Check if token is expired
  if (tokenRecord.expiresAt < new Date()) {
    await prisma.emailVerificationToken.delete({ where: { token } });
    return null;
  }

  // Mark user as verified
  await prisma.user.update({
    where: { id: tokenRecord.userId },
    data: {
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  // Delete the token
  await prisma.emailVerificationToken.delete({ where: { token } });

  return {
    userId: tokenRecord.userId,
    email: tokenRecord.user.email,
  };
}

/**
 * Verify a password reset token
 */
export async function verifyPasswordResetToken(
  token: string
): Promise<{ userId: string; email: string } | null> {
  const tokenRecord = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!tokenRecord) {
    return null;
  }

  // Check if token is expired
  if (tokenRecord.expiresAt < new Date()) {
    await prisma.passwordResetToken.delete({ where: { token } });
    return null;
  }

  // Check if token was already used
  if (tokenRecord.usedAt) {
    return null;
  }

  return {
    userId: tokenRecord.userId,
    email: tokenRecord.user.email,
  };
}

/**
 * Mark a password reset token as used
 */
export async function markPasswordResetTokenUsed(token: string): Promise<void> {
  await prisma.passwordResetToken.update({
    where: { token },
    data: { usedAt: new Date() },
  });
}

/**
 * Send subscription confirmed email
 */
export async function sendSubscriptionConfirmedEmail(
  email: string,
  name: string,
  tier: string
): Promise<void> {
  const tierName = tier === 'pro' ? 'Pro' : tier.charAt(0).toUpperCase() + tier.slice(1);
  const weeklyLimit = tier === 'pro' ? 30 : 5;

  try {
    if (!resend) return; // Skip email sending if Resend not configured

    // Get user's preferred language
    const locale = await getUserLocaleByEmail(email);
    const t = i18next.getFixedT(locale, 'email');

    const html = generateSubscriptionConfirmedEmail({
      locale,
      name,
      tier: tierName,
      weeklyLimit,
      appUrl: CLIENT_URL,
    });
    const subject = t('subscriptionConfirmed.subject', { tier: tierName });

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      replyTo: REPLY_TO_EMAIL,
      subject,
      html,
    });

    console.log(`✓ Subscription confirmed email sent to ${email} (${locale})`);
  } catch (error) {
    console.error('Error sending subscription confirmed email:', error);
    // Don't throw - notification email is nice to have but not critical
  }
}

/**
 * Send payment failed email
 */
export async function sendPaymentFailedEmail(email: string, name: string): Promise<void> {
  try {
    if (!resend) return; // Skip email sending if Resend not configured

    // Get user's preferred language
    const locale = await getUserLocaleByEmail(email);
    const t = i18next.getFixedT(locale, 'email');

    const html = generatePaymentFailedEmail({
      locale,
      name,
      billingUrl: `${CLIENT_URL}/app/settings/billing`,
      supportEmail: REPLY_TO_EMAIL,
    });
    const subject = t('paymentFailed.subject');

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      replyTo: REPLY_TO_EMAIL,
      subject,
      html,
    });

    console.log(`✓ Payment failed email sent to ${email} (${locale})`);
  } catch (error) {
    console.error('Error sending payment failed email:', error);
    // Don't throw - notification email is nice to have but not critical
  }
}

/**
 * Send subscription canceled email
 */
export async function sendSubscriptionCanceledEmail(email: string, name: string): Promise<void> {
  try {
    if (!resend) return; // Skip email sending if Resend not configured

    // Get user's preferred language
    const locale = await getUserLocaleByEmail(email);
    const t = i18next.getFixedT(locale, 'email');

    const html = generateSubscriptionCanceledEmail({
      locale,
      name,
      billingUrl: `${CLIENT_URL}/app/settings/billing`,
    });
    const subject = t('subscriptionCanceled.subject');

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      replyTo: REPLY_TO_EMAIL,
      subject,
      html,
    });

    console.log(`✓ Subscription canceled email sent to ${email} (${locale})`);
  } catch (error) {
    console.error('Error sending subscription canceled email:', error);
    // Don't throw - notification email is nice to have but not critical
  }
}

/**
 * Send quota warning email (when user reaches 80% of their limit)
 */
export async function sendQuotaWarningEmail(
  email: string,
  name: string,
  used: number,
  limit: number,
  tier: string
): Promise<void> {
  const percentage = Math.round((used / limit) * 100);

  try {
    if (!resend) return; // Skip email sending if Resend not configured

    // Get user's preferred language
    const locale = await getUserLocaleByEmail(email);
    const t = i18next.getFixedT(locale, 'email');

    const html = generateQuotaWarningEmail({
      locale,
      name,
      used,
      limit,
      percentage,
      tier,
      pricingUrl: `${CLIENT_URL}/pricing`,
    });
    const subject = t('quotaWarning.subject', { percentage });

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      replyTo: REPLY_TO_EMAIL,
      subject,
      html,
    });

    console.log(`✓ Quota warning email sent to ${email} (${locale})`);
  } catch (error) {
    console.error('Error sending quota warning email:', error);
    // Don't throw - notification email is nice to have but not critical
  }
}
