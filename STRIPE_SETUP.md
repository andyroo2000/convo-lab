# Stripe Setup for Production (Live + Test Products)

This guide explains how to set up both a live production product and a test product that works in your production environment.

## Overview

You'll create two products in Stripe **Live Mode**:

1. **ConvoLab Pro** ($7/month) - Your real production product
2. **ConvoLab Test** ($0.01/month) - For testing checkout flow in production without real charges

## Step 1: Create Products in Stripe (Live Mode)

### Switch to Live Mode

1. Go to https://dashboard.stripe.com
2. **Toggle to "Live" mode** in the top-right corner (important!)

### Create Production Product

1. Navigate to **Products** → **+ Add product**
2. Fill in:
   - **Name**: `ConvoLab Pro`
   - **Description**: `Premium tier with 30 generations per week`
   - **Pricing Model**: Standard pricing
   - **Price**: $7.00 USD
   - **Billing period**: Monthly (recurring)
3. Click **Save product**
4. **Copy the Price ID** (starts with `price_live_...`)
   - Save this as: `STRIPE_PRICE_PRO_MONTHLY`

### Create Test Product

1. Click **+ Add product** again
2. Fill in:
   - **Name**: `ConvoLab Test`
   - **Description**: `Test tier for internal testing - do not use for real customers`
   - **Pricing Model**: Standard pricing
   - **Price**: $0.01 USD (1 cent - minimal charge to test real payments)
   - **Billing period**: Monthly (recurring)
3. Click **Save product**
4. **Copy the Price ID** (starts with `price_live_...`)
   - Save this as: `STRIPE_PRICE_TEST_MONTHLY`

## Step 2: Set Up Webhook

1. Go to **Developers** → **Webhooks**
2. Click **+ Add endpoint**
3. Endpoint URL: `https://api.convolab.app/api/webhooks/stripe`
4. Select events to listen to:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Click **Add endpoint**
6. **Copy the Webhook signing secret** (starts with `whsec_`)

## Step 3: Get API Keys

1. Go to **Developers** → **API keys**
2. You should see your **Live mode** keys:
   - **Publishable key** (starts with `pk_live_...`)
   - **Secret key** - click "Reveal live key" (starts with `sk_live_...`)
3. Copy both keys

## Step 4: Configure Environment Variables

### Backend (Cloud Run)

Set these environment variables in your Cloud Run service:

```bash
# Stripe Live API Keys
STRIPE_SECRET_KEY=sk_live_your_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_publishable_key

# Webhook Secret
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Product Price IDs
STRIPE_PRICE_PRO_MONTHLY=price_live_your_pro_price_id
STRIPE_PRICE_TEST_MONTHLY=price_live_your_test_price_id  # Optional - only if you want test tier visible
```

To set in Cloud Run:

```bash
gcloud run services update languageflow-backend \
  --region=us-central1 \
  --update-env-vars STRIPE_SECRET_KEY=sk_live_xxx,STRIPE_PRICE_PRO_MONTHLY=price_live_xxx,STRIPE_PRICE_TEST_MONTHLY=price_live_xxx
```

### Frontend

Update your frontend build environment variables:

```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_publishable_key
VITE_STRIPE_PRICE_PRO_MONTHLY=price_live_your_pro_price_id
VITE_STRIPE_PRICE_TEST_MONTHLY=price_live_your_test_price_id  # Optional - only if you want test tier visible
```

## Step 5: Testing in Production

### Test the Test Product

1. Deploy your updated code to production
2. Log in to your production app
3. Go to `/pricing`
4. You should see three tiers: **Free**, **Test**, and **Pro**
5. Click "Test Checkout" on the Test tier
6. Use a real credit card (you'll be charged $0.01)
7. Complete the checkout flow
8. Verify:
   - Subscription shows in Stripe Dashboard
   - User tier upgraded to "pro" in your database
   - Webhook events processed correctly

### Test the Live Product

1. Click "Upgrade to Pro" on the Pro tier
2. Use a real credit card (you'll be charged $7.00)
3. Complete the checkout flow
4. Verify everything works

### Hide Test Tier from Public

Once you've tested, you can hide the test tier from public view:

**Option 1: Remove from frontend environment**

- Simply don't set `VITE_STRIPE_PRICE_TEST_MONTHLY` in production
- The test tier won't appear on the pricing page

**Option 2: Keep for admin testing**

- Keep `VITE_STRIPE_PRICE_TEST_MONTHLY` set
- Only admins or internal team members use it

## Important Notes

### Why This Works

- Both products are in **Live Mode** (real Stripe products)
- The test product charges a real (but minimal) amount
- This lets you test the complete payment flow in production
- No need to switch between test/live modes

### Canceling Test Subscriptions

After testing, cancel test subscriptions:

1. Go to Stripe Dashboard → **Customers**
2. Find your test customer
3. Cancel the test subscription
4. Optionally refund the $0.01

### Security

- The backend validates that only whitelisted price IDs are accepted
- Both price IDs are validated at `server/src/routes/billing.ts:37-43`
- No arbitrary price IDs can be submitted

## Troubleshooting

### Test tier not showing up

- Check that `VITE_STRIPE_PRICE_TEST_MONTHLY` is set in frontend environment
- Rebuild and redeploy frontend

### "Invalid price ID" error

- Verify `STRIPE_PRICE_TEST_MONTHLY` is set in backend environment
- Check that price ID starts with `price_live_` (not `price_test_`)

### Webhook not firing

- Check webhook URL matches your production API
- Verify `STRIPE_WEBHOOK_SECRET` is correct
- Check Stripe Dashboard → Webhooks → Recent deliveries for errors

## Summary

You now have:

- ✅ Live production product ($7/month)
- ✅ Test product for production testing ($0.01/month)
- ✅ Both work in production with real payments
- ✅ Test tier only visible when configured
- ✅ Secure price ID validation

The test product lets you verify the complete checkout flow in production without worrying about large charges!
