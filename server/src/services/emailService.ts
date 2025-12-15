import { Resend } from 'resend';
import crypto from 'crypto';
import { prisma } from '../db/client.js';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM || 'ConvoLab <noreply@convolab.app>';
const REPLY_TO_EMAIL = process.env.EMAIL_REPLY_TO || 'support@convolab.app';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

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
    where: { userId }
  });

  // Generate token (expires in 24 hours)
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Create token in database
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      token,
      expiresAt
    }
  });

  // Send email
  const verificationUrl = `${CLIENT_URL}/verify-email/${token}`;

  try {
    // In development, log the URL to console instead of sending email
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✉️  EMAIL VERIFICATION (DEV MODE)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`To: ${email}`);
      console.log(`Subject: Verify your ConvoLab email`);
      console.log(`\n🔗 Verification Link (expires in 24 hours):`);
      console.log(`   ${verificationUrl}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return;
    }

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      replyTo: REPLY_TO_EMAIL,
      subject: 'Verify your ConvoLab email',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to ConvoLab!</h1>
            </div>

            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-top: 0;">Hi ${name},</p>

              <p style="font-size: 16px;">Thanks for signing up! Please verify your email address to start creating language learning content.</p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" style="background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px;">Verify Email Address</a>
              </div>

              <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
              <p style="font-size: 14px; color: #667eea; word-break: break-all;">${verificationUrl}</p>

              <p style="font-size: 14px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
            </div>
          </body>
        </html>
      `
    });

    console.log(`✓ Verification email sent to ${email}`);
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
    where: { userId }
  });

  // Generate token (expires in 1 hour)
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  // Create token in database
  await prisma.passwordResetToken.create({
    data: {
      userId,
      token,
      expiresAt
    }
  });

  // Send email
  const resetUrl = `${CLIENT_URL}/reset-password/${token}`;

  try {
    // In development, log the URL to console instead of sending email
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔑 PASSWORD RESET (DEV MODE)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`To: ${email}`);
      console.log(`Subject: Reset your ConvoLab password`);
      console.log(`\n🔗 Reset Link (expires in 1 hour):`);
      console.log(`   ${resetUrl}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return;
    }

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      replyTo: REPLY_TO_EMAIL,
      subject: 'Reset your ConvoLab password',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f44336; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Reset Your Password</h1>
            </div>

            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-top: 0;">Hi ${name},</p>

              <p style="font-size: 16px;">We received a request to reset your password. Click the button below to create a new password.</p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background: #f44336; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px;">Reset Password</a>
              </div>

              <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
              <p style="font-size: 14px; color: #f44336; word-break: break-all;">${resetUrl}</p>

              <p style="font-size: 14px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
            </div>
          </body>
        </html>
      `
    });

    console.log(`✓ Password reset email sent to ${email}`);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
}

/**
 * Send a welcome email after email verification
 */
export async function sendWelcomeEmail(
  email: string,
  name: string
): Promise<void> {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      replyTo: REPLY_TO_EMAIL,
      subject: 'Welcome to ConvoLab!',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎉 You're All Set!</h1>
            </div>

            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-top: 0;">Hi ${name},</p>

              <p style="font-size: 16px;">Your email has been verified! You can now start creating immersive language learning content.</p>

              <h2 style="color: #667eea; font-size: 20px; margin-top: 30px;">What you can create:</h2>
              <ul style="font-size: 16px; line-height: 1.8;">
                <li><strong>Dialogues:</strong> Natural conversations with multiple speakers</li>
                <li><strong>Audio Courses:</strong> Pimsleur-style lessons with backward-building</li>
                <li><strong>Narrow Listening:</strong> Focused practice on grammar patterns</li>
                <li><strong>Lexical Chunks:</strong> Master common phrases and expressions</li>
              </ul>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${CLIENT_URL}" style="background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px;">Start Creating</a>
              </div>

              <p style="font-size: 14px; color: #666; margin-top: 30px;">Need help getting started? Check out our <a href="${CLIENT_URL}/help" style="color: #667eea;">Getting Started Guide</a>.</p>

              <p style="font-size: 14px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">Questions? Reply to this email anytime!</p>
            </div>
          </body>
        </html>
      `
    });

    console.log(`✓ Welcome email sent to ${email}`);
  } catch (error) {
    console.error('Error sending welcome email:', error);
    // Don't throw - welcome email is nice to have but not critical
  }
}

/**
 * Send a confirmation email after password change
 */
export async function sendPasswordChangedEmail(
  email: string,
  name: string
): Promise<void> {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      replyTo: REPLY_TO_EMAIL,
      subject: 'Your ConvoLab password was changed',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #4caf50; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Password Changed</h1>
            </div>

            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-top: 0;">Hi ${name},</p>

              <p style="font-size: 16px;">This is a confirmation that your ConvoLab password has been successfully changed.</p>

              <p style="font-size: 16px;">If you made this change, you can safely ignore this email.</p>

              <div style="background: #fff3cd; border-left: 4px solid #ff9800; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #856404;"><strong>⚠️ Didn't make this change?</strong></p>
                <p style="margin: 10px 0 0 0; font-size: 14px; color: #856404;">If you did not change your password, please contact us immediately at ${REPLY_TO_EMAIL}</p>
              </div>

              <p style="font-size: 14px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">This is an automated security notification.</p>
            </div>
          </body>
        </html>
      `
    });

    console.log(`✓ Password changed email sent to ${email}`);
  } catch (error) {
    console.error('Error sending password changed email:', error);
    // Don't throw - notification email is nice to have but not critical
  }
}

/**
 * Verify an email verification token
 */
export async function verifyEmailToken(token: string): Promise<{ userId: string; email: string } | null> {
  const tokenRecord = await prisma.emailVerificationToken.findUnique({
    where: { token },
    include: { user: true }
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
      emailVerifiedAt: new Date()
    }
  });

  // Delete the token
  await prisma.emailVerificationToken.delete({ where: { token } });

  return {
    userId: tokenRecord.userId,
    email: tokenRecord.user.email
  };
}

/**
 * Verify a password reset token
 */
export async function verifyPasswordResetToken(token: string): Promise<{ userId: string; email: string } | null> {
  const tokenRecord = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true }
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
    email: tokenRecord.user.email
  };
}

/**
 * Mark a password reset token as used
 */
export async function markPasswordResetTokenUsed(token: string): Promise<void> {
  await prisma.passwordResetToken.update({
    where: { token },
    data: { usedAt: new Date() }
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
  const weeklyLimit = tier === 'pro' ? '30' : '5';

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      replyTo: REPLY_TO_EMAIL,
      subject: `Welcome to ConvoLab ${tierName}!`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #4caf50 0%, #45a049 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Welcome to ${tierName}!</h1>
            </div>

            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-top: 0;">Hi ${name},</p>

              <p style="font-size: 16px;">Your ConvoLab ${tierName} subscription is now active! Thank you for supporting our mission to make language learning more immersive and effective.</p>

              <div style="background: white; border: 2px solid #4caf50; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h2 style="color: #4caf50; margin-top: 0; font-size: 20px;">Your ${tierName} Benefits</h2>
                <ul style="font-size: 16px; line-height: 1.8; margin: 15px 0;">
                  <li><strong>${weeklyLimit} generations per week</strong></li>
                  <li>All content types (dialogues, courses, narrow listening, chunks)</li>
                  <li>High-quality Google Cloud TTS audio</li>
                  <li>Priority support</li>
                </ul>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${CLIENT_URL}/app/library" style="background: #4caf50; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px;">Start Creating</a>
              </div>

              <p style="font-size: 14px; color: #666; margin-top: 30px;">You can manage your subscription anytime from your <a href="${CLIENT_URL}/app/settings/billing" style="color: #4caf50;">billing settings</a>.</p>

              <p style="font-size: 14px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">Questions? Reply to this email anytime!</p>
            </div>
          </body>
        </html>
      `
    });

    console.log(`✓ Subscription confirmed email sent to ${email}`);
  } catch (error) {
    console.error('Error sending subscription confirmed email:', error);
    // Don't throw - notification email is nice to have but not critical
  }
}

/**
 * Send payment failed email
 */
export async function sendPaymentFailedEmail(
  email: string,
  name: string
): Promise<void> {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      replyTo: REPLY_TO_EMAIL,
      subject: 'ConvoLab payment failed - Action required',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f44336; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Payment Failed</h1>
            </div>

            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-top: 0;">Hi ${name},</p>

              <p style="font-size: 16px;">We were unable to process your payment for your ConvoLab subscription. This could be due to:</p>

              <ul style="font-size: 16px; line-height: 1.8;">
                <li>Insufficient funds</li>
                <li>Expired card</li>
                <li>Card verification issue</li>
              </ul>

              <div style="background: #fff3cd; border-left: 4px solid #ff9800; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #856404;"><strong>⚠️ Action Required</strong></p>
                <p style="margin: 10px 0 0 0; font-size: 14px; color: #856404;">Please update your payment method to avoid service interruption.</p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${CLIENT_URL}/app/settings/billing" style="background: #f44336; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px;">Update Payment Method</a>
              </div>

              <p style="font-size: 14px; color: #666;">If you continue to have issues, please contact us at ${REPLY_TO_EMAIL}</p>

              <p style="font-size: 14px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">This is an automated payment notification.</p>
            </div>
          </body>
        </html>
      `
    });

    console.log(`✓ Payment failed email sent to ${email}`);
  } catch (error) {
    console.error('Error sending payment failed email:', error);
    // Don't throw - notification email is nice to have but not critical
  }
}

/**
 * Send subscription canceled email
 */
export async function sendSubscriptionCanceledEmail(
  email: string,
  name: string
): Promise<void> {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      replyTo: REPLY_TO_EMAIL,
      subject: 'Your ConvoLab subscription has been canceled',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #9e9e9e; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Subscription Canceled</h1>
            </div>

            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-top: 0;">Hi ${name},</p>

              <p style="font-size: 16px;">Your ConvoLab Pro subscription has been canceled and you've been downgraded to the Free tier.</p>

              <div style="background: white; border: 2px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h2 style="color: #666; margin-top: 0; font-size: 20px;">Free Tier Limits</h2>
                <ul style="font-size: 16px; line-height: 1.8; margin: 15px 0; color: #666;">
                  <li><strong>5 generations per week</strong></li>
                  <li>All content types available</li>
                  <li>Standard support</li>
                </ul>
              </div>

              <p style="font-size: 16px;">We're sorry to see you go! If you'd like to share feedback about why you canceled, we'd love to hear from you.</p>

              <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #0d47a1;">You can reactivate your Pro subscription anytime from your billing settings.</p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${CLIENT_URL}/app/settings/billing" style="background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px;">View Billing Settings</a>
              </div>

              <p style="font-size: 14px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">Questions? Reply to this email anytime!</p>
            </div>
          </body>
        </html>
      `
    });

    console.log(`✓ Subscription canceled email sent to ${email}`);
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
  const remaining = limit - used;
  const percentage = Math.round((used / limit) * 100);

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      replyTo: REPLY_TO_EMAIL,
      subject: `You've used ${percentage}% of your weekly ConvoLab quota`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #ff9800; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">⚠️ Quota Warning</h1>
            </div>

            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-top: 0;">Hi ${name},</p>

              <p style="font-size: 16px;">You've used <strong>${used} of ${limit}</strong> generations this week (${percentage}%).</p>

              <div style="background: white; border: 2px solid #ff9800; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <div style="font-size: 14px; color: #666; margin-bottom: 10px;">Weekly Usage</div>
                <div style="background: #e0e0e0; border-radius: 10px; height: 30px; overflow: hidden;">
                  <div style="background: linear-gradient(90deg, #ff9800 0%, #f57c00 100%); height: 100%; width: ${percentage}%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 14px;">${percentage}%</div>
                </div>
                <div style="font-size: 14px; color: #666; margin-top: 10px; text-align: center;">
                  <strong>${remaining} generation${remaining !== 1 ? 's' : ''} remaining</strong>
                </div>
              </div>

              ${tier === 'free' ? `
                <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0; font-size: 14px; color: #0d47a1;"><strong>💡 Need more?</strong></p>
                  <p style="margin: 10px 0 0 0; font-size: 14px; color: #0d47a1;">Upgrade to Pro for 30 generations per week ($7/month)</p>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${CLIENT_URL}/pricing" style="background: #2196f3; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px;">Upgrade to Pro</a>
                </div>
              ` : `
                <p style="font-size: 14px; color: #666;">Your quota resets every Monday at midnight UTC.</p>
              `}

              <p style="font-size: 14px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">This is an automated usage notification.</p>
            </div>
          </body>
        </html>
      `
    });

    console.log(`✓ Quota warning email sent to ${email}`);
  } catch (error) {
    console.error('Error sending quota warning email:', error);
    // Don't throw - notification email is nice to have but not critical
  }
}
