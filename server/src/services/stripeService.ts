/* eslint-disable no-console */
import Stripe from 'stripe';

import { prisma } from '../db/client.js';

import {
  sendSubscriptionConfirmedEmail,
  sendPaymentFailedEmail,
  sendSubscriptionCanceledEmail,
} from './emailService.js';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY not set - Stripe functionality will not work');
}

const STRIPE_API_VERSION = '2024-12-18.acacia';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
});

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

type SubscriptionPeriodFields = {
  current_period_start: number;
  current_period_end: number;
};

const getSubscriptionPeriodFields = (
  subscription: Stripe.Subscription
): SubscriptionPeriodFields => {
  const { current_period_start, current_period_end } = subscription as Stripe.Subscription &
    SubscriptionPeriodFields;

  return { current_period_start, current_period_end };
};

/**
 * Create a Stripe checkout session for subscription
 */
export async function createCheckoutSession(
  userId: string,
  priceId: string
): Promise<{ url: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, stripeCustomerId: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Create or retrieve Stripe customer
  let customerId = user.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: {
        userId,
      },
    });

    customerId = customer.id;

    // Save customer ID to database
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId },
    });
  }

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${CLIENT_URL}/app/settings/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${CLIENT_URL}/app/settings/billing`,
    subscription_data: {
      metadata: {
        userId,
      },
    },
    metadata: {
      userId,
    },
  });

  if (!session.url) {
    throw new Error('Failed to create checkout session');
  }

  return { url: session.url };
}

/**
 * Create a Stripe customer portal session
 */
export async function createCustomerPortalSession(userId: string): Promise<{ url: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId) {
    throw new Error('No Stripe customer found');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${CLIENT_URL}/app/settings/billing`,
  });

  return { url: session.url };
}

/**
 * Handle subscription created webhook
 */
export async function handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
  const { userId } = subscription.metadata;
  const { current_period_start, current_period_end } = getSubscriptionPeriodFields(subscription);

  if (!userId) {
    console.error('No userId in subscription metadata');
    return;
  }

  // Determine tier from price
  const priceId = subscription.items.data[0]?.price.id;
  const tier = 'pro'; // Both test and pro subscriptions map to 'pro' tier in database

  // Update user subscription status
  await prisma.user.update({
    where: { id: userId },
    data: {
      tier,
      stripeSubscriptionId: subscription.id,
      stripeSubscriptionStatus: subscription.status,
      stripePriceId: priceId,
      subscriptionStartedAt: new Date(current_period_start * 1000),
      subscriptionExpiresAt: new Date(current_period_end * 1000),
      subscriptionCanceledAt: null,
    },
  });

  // Log subscription event
  await prisma.subscriptionEvent.create({
    data: {
      userId,
      eventType: 'subscribed',
      fromTier: 'free',
      toTier: tier,
      stripeEventId: subscription.id,
    },
  });

  // Send confirmation email
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  if (user) {
    await sendSubscriptionConfirmedEmail(user.email, user.name, tier);
  }

  console.log(`✓ Subscription created for user ${userId}, tier: ${tier}`);
}

/**
 * Handle subscription updated webhook
 */
export async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const { userId } = subscription.metadata;
  const { current_period_end } = getSubscriptionPeriodFields(subscription);

  if (!userId) {
    // Try to find user by customer ID
    const user = await prisma.user.findUnique({
      where: { stripeCustomerId: subscription.customer as string },
      select: { id: true },
    });

    if (!user) {
      console.error('No user found for subscription update');
      return;
    }
  }

  const priceId = subscription.items.data[0]?.price.id;
  // Update subscription status
  await prisma.user.update({
    where: userId ? { id: userId } : { stripeCustomerId: subscription.customer as string },
    data: {
      stripeSubscriptionStatus: subscription.status,
      stripePriceId: priceId,
      subscriptionExpiresAt: new Date(current_period_end * 1000),
      // If subscription was canceled, mark when it will end
      ...(subscription.cancel_at_period_end && {
        subscriptionCanceledAt: new Date(current_period_end * 1000),
      }),
    },
  });

  console.log(
    `✓ Subscription updated for customer ${subscription.customer}, status: ${subscription.status}`
  );
}

/**
 * Handle subscription deleted webhook
 */
export async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const { userId } = subscription.metadata;

  if (!userId) {
    // Try to find user by customer ID
    const user = await prisma.user.findUnique({
      where: { stripeCustomerId: subscription.customer as string },
      select: { id: true, tier: true, email: true, name: true },
    });

    if (!user) {
      console.error('No user found for subscription deletion');
      return;
    }

    // Downgrade to free tier
    await prisma.user.update({
      where: { id: user.id },
      data: {
        tier: 'free',
        stripeSubscriptionStatus: null,
        stripeSubscriptionId: null,
        stripePriceId: null,
        subscriptionCanceledAt: new Date(),
      },
    });

    // Log subscription event
    await prisma.subscriptionEvent.create({
      data: {
        userId: user.id,
        eventType: 'canceled',
        fromTier: user.tier,
        toTier: 'free',
        stripeEventId: subscription.id,
      },
    });

    // Send cancelation email
    await sendSubscriptionCanceledEmail(user.email, user.name);

    console.log(`✓ Subscription deleted for user ${user.id}, downgraded to free`);
    return;
  }

  // Get current tier
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true, email: true, name: true },
  });

  if (!user) {
    return;
  }

  // Downgrade to free tier
  await prisma.user.update({
    where: { id: userId },
    data: {
      tier: 'free',
      stripeSubscriptionStatus: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      subscriptionCanceledAt: new Date(),
    },
  });

  // Log subscription event
  await prisma.subscriptionEvent.create({
    data: {
      userId,
      eventType: 'canceled',
      fromTier: user.tier,
      toTier: 'free',
      stripeEventId: subscription.id,
    },
  });

  // Send cancelation email
  await sendSubscriptionCanceledEmail(user.email, user.name);

  console.log(`✓ Subscription deleted for user ${userId}, downgraded to free`);
}

/**
 * Handle invoice payment failed webhook
 */
export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string;

  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    console.error('No user found for failed payment');
    return;
  }

  // Send payment failed email
  await sendPaymentFailedEmail(user.email, user.name);

  console.log(`✓ Payment failed notification sent to user ${user.id}`);
}

/**
 * Get user's subscription status
 */
export async function getSubscriptionStatus(userId: string): Promise<{
  tier: string;
  status: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      tier: true,
      stripeSubscriptionStatus: true,
      stripeSubscriptionId: true,
      subscriptionExpiresAt: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  let cancelAtPeriodEnd = false;

  // If user has active subscription, check if it's set to cancel
  if (user.stripeSubscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      cancelAtPeriodEnd = subscription.cancel_at_period_end;
    } catch (error) {
      console.error('Failed to retrieve subscription:', error);
    }
  }

  return {
    tier: user.tier,
    status: user.stripeSubscriptionStatus,
    cancelAtPeriodEnd,
    currentPeriodEnd: user.subscriptionExpiresAt,
  };
}
