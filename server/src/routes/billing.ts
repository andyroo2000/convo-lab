import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import {
  createCheckoutSession,
  createCustomerPortalSession,
  getSubscriptionStatus,
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaymentFailed
} from '../services/stripeService.js';
import Stripe from 'stripe';
import { prisma } from '../db/client.js';
import i18next from '../i18n/index.js';

const router = Router();

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY not set - Stripe functionality will not work');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2024-12-18.acacia' as any,
});

/**
 * Create a Stripe checkout session
 */
router.post('/billing/create-checkout-session', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { priceId } = req.body;
    const userId = req.userId!

    if (!priceId) {
      return res.status(400).json({ error: { message: i18next.t('server:billing.priceIdRequired') } });
    }

    // Validate price ID matches configured Pro or Test price
    const validPriceIds = [
      process.env.STRIPE_PRICE_PRO_MONTHLY,
      process.env.STRIPE_PRICE_TEST_MONTHLY
    ].filter(Boolean);

    if (!validPriceIds.includes(priceId)) {
      return res.status(400).json({ error: { message: i18next.t('server:billing.invalidPriceId') } });
    }

    // Ensure only test users can subscribe to test tier
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isTestUser: true }
    });

    if (priceId === process.env.STRIPE_PRICE_TEST_MONTHLY && !user?.isTestUser) {
      return res.status(403).json({
        error: { message: i18next.t('server:billing.testTierOnly') }
      });
    }

    const session = await createCheckoutSession(userId, priceId);

    res.json(session);
  } catch (error) {
    console.error('Failed to create checkout session:', error);
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : i18next.t('server:billing.checkoutFailed')
      }
    });
  }
});

/**
 * Create a Stripe customer portal session
 */
router.post('/billing/create-portal-session', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const session = await createCustomerPortalSession(userId);

    res.json(session);
  } catch (error) {
    console.error('Failed to create portal session:', error);
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : i18next.t('server:billing.portalFailed')
      }
    });
  }
});

/**
 * Get current subscription status
 */
router.get('/billing/subscription-status', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const status = await getSubscriptionStatus(userId);

    res.json(status);
  } catch (error) {
    console.error('Failed to get subscription status:', error);
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : i18next.t('server:billing.subscriptionFailed')
      }
    });
  }
});

/**
 * Stripe webhook handler
 *
 * This endpoint receives events from Stripe webhooks and processes them.
 * Authentication is done via Stripe signature verification.
 */
router.post('/webhooks/stripe', async (req, res) => {
  const signature = req.headers['stripe-signature'];

  if (!signature) {
    console.error('No stripe-signature header present');
    return res.status(400).json({ error: { message: i18next.t('server:billing.noSignature') } });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: { message: i18next.t('server:billing.webhookSecretMissing') } });
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return res.status(400).json({
      error: {
        message: error instanceof Error ? error.message : i18next.t('server:billing.signatureVerificationFailed')
      }
    });
  }

  try {
    // Handle the event
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : i18next.t('server:billing.webhookProcessingFailed')
      }
    });
  }
});

export default router;
