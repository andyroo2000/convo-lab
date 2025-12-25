# Next Steps: Stripe Production Setup

## Current Status

### ✅ Completed

- [x] Test user feature fully implemented in code
- [x] Database migration applied (isTestUser field added)
- [x] Admin panel UI for toggling test users
- [x] Pricing page showing test tier for test users only
- [x] Billing validation preventing non-test users from accessing test tier
- [x] All code changes committed and pushed to GitHub
- [x] Tested locally with test user in development

### 🔄 In Progress

You are about to set up Stripe products in **Live Mode** for production.

### ⏳ Todo

#### 1. Create Stripe Products (Live Mode)

**IMPORTANT:** Do this in Stripe Dashboard **LIVE MODE** (toggle in top-right corner)

##### A. Create Test Product ($0.01/month)

1. Go to https://dashboard.stripe.com/products (ensure "Live" mode)
2. Click **+ Add product**
3. Fill in:
   - **Name**: `ConvoLab Test`
   - **Description**: `Test tier for internal testing - do not use for real customers`
   - **Pricing Model**: Standard pricing
   - **Price**: $0.01 USD
   - **Billing period**: Monthly (recurring)
4. Click **Save product**
5. **Copy the Price ID** (starts with `price_live_...`)
   - You'll need this for: `STRIPE_PRICE_TEST_MONTHLY`

##### B. Create Production Product ($7/month)

1. Click **+ Add product** again
2. Fill in:
   - **Name**: `ConvoLab Pro`
   - **Description**: `Premium tier with 30 generations per week`
   - **Pricing Model**: Standard pricing
   - **Price**: $7.00 USD
   - **Billing period**: Monthly (recurring)
3. Click **Save product**
4. **Copy the Price ID** (starts with `price_live_...`)
   - You'll need this for: `STRIPE_PRICE_PRO_MONTHLY`

#### 2. Set Up Production Webhook

1. Go to **Developers** → **Webhooks** (in Live mode)
2. Click **+ Add endpoint**
3. Endpoint URL: `https://api.convolab.app/api/webhooks/stripe` (or your production API URL)
4. Select events to listen to:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Click **Add endpoint**
6. **Copy the Webhook signing secret** (starts with `whsec_`)
   - You'll need this for: `STRIPE_WEBHOOK_SECRET`

#### 3. Update Production Environment Variables

##### Backend (Cloud Run)

Set these environment variables in your Cloud Run service:

```bash
STRIPE_SECRET_KEY=sk_live_your_live_key  # Get from Stripe Dashboard > Developers > API keys
STRIPE_PUBLISHABLE_KEY=pk_live_your_publishable_key  # Get from Stripe Dashboard > Developers > API keys
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret  # From step 2 above
STRIPE_PRICE_PRO_MONTHLY=price_live_xxx  # From step 1B above
STRIPE_PRICE_TEST_MONTHLY=price_live_xxx  # From step 1A above
```

##### Frontend (Build Environment)

Update your frontend build environment:

```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_publishable_key
VITE_STRIPE_PRICE_PRO_MONTHLY=price_live_xxx  # From step 1B above
VITE_STRIPE_PRICE_TEST_MONTHLY=price_live_xxx  # From step 1A above (optional - only if you want test tier visible)
```

#### 4. Deploy to Production

```bash
# Backend
cd server
npm run build
./deploy.sh

# Frontend
cd client
npm run build
# Deploy to your hosting (Vercel, Netlify, etc.)
```

#### 5. Test in Production

1. Log in as admin
2. Navigate to `/admin`
3. Find a user and click to view details
4. Toggle "Enable Test User" to on
5. Log in as that test user
6. Navigate to `/pricing`
7. Verify test tier is visible
8. Click "Test Checkout" and use a real card (will charge $0.01)
9. Complete checkout and verify subscription works

#### 6. Test Real Product

1. As a non-test user, go to `/pricing`
2. Verify only Free and Pro tiers are visible (no test tier)
3. Click "Upgrade to Pro"
4. Use a real card (will charge $7.00)
5. Verify subscription activates correctly

## Important Notes

- **Both products are in Live Mode** - they use real payment processing
- The test product charges a real (but minimal) $0.01
- Test tier is only visible when user has `isTestUser = true`
- Backend prevents non-test users from accessing test tier (403 Forbidden)
- You can cancel test subscriptions in Stripe Dashboard after testing

## Reference Files

- **Detailed setup guide**: `STRIPE_SETUP.md`
- **Local testing guide**: `README.md` (see "Testing Stripe Subscriptions Locally" section)
- **Code changes**: See commit `16ebc7d` - "feat: add test user feature for safe production testing"

## Commands to Set Cloud Run Environment Variables

```bash
# Set all at once
gcloud run services update languageflow-backend \
  --region=us-central1 \
  --update-env-vars \
STRIPE_SECRET_KEY=sk_live_xxx,\
STRIPE_PUBLISHABLE_KEY=pk_live_xxx,\
STRIPE_WEBHOOK_SECRET=whsec_xxx,\
STRIPE_PRICE_PRO_MONTHLY=price_live_xxx,\
STRIPE_PRICE_TEST_MONTHLY=price_live_xxx
```

## Quick Resume Checklist

When you restart and want to continue:

1. [ ] Open Stripe Dashboard in Live Mode
2. [ ] Create test product ($0.01/month) - copy price ID
3. [ ] Create pro product ($7/month) - copy price ID
4. [ ] Set up production webhook - copy signing secret
5. [ ] Update Cloud Run env vars with all price IDs and keys
6. [ ] Update frontend build env vars
7. [ ] Deploy backend and frontend
8. [ ] Test with test user
9. [ ] Test with regular user

---

**Last Updated:** 2025-12-18 (after commit 16ebc7d)
