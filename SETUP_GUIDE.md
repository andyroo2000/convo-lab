# ConvoLab Auth & Monetization Setup Guide

## ✅ Completed

- Database migration applied successfully
- All code implementation complete (Phases 1-3)
- Your admin account email verified

## Remaining Setup Tasks

### 1. Set up Google OAuth (15 minutes)

**Go to Google Cloud Console:**

1. Visit: https://console.cloud.google.com/
2. Select your project (or create a new one for ConvoLab)

**Create OAuth 2.0 Credentials:**

1. Navigate to: **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `ConvoLab Production`

**Configure authorized redirect URIs:**

For local development:

```
http://localhost:3001/api/auth/google/callback
```

For production (update with your actual domain):

```
https://api.convolab.app/api/auth/google/callback
```

**Get your credentials:**

- Copy the **Client ID** (looks like: `123456789-abc123.apps.googleusercontent.com`)
- Copy the **Client Secret** (looks like: `GOCSPX-abc123xyz789`)

**Update your .env file:**

```bash
# Replace these with your actual values
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback
```

---

### 2. Set up Stripe (20 minutes)

**Create/Login to Stripe account:**

1. Visit: https://dashboard.stripe.com/register
2. Complete account setup

**Create your product:**

1. Go to: **Products** → **+ Add product**
2. Name: `ConvoLab Pro`
3. Description: `Premium tier with 30 generations per week`
4. Pricing:
   - **Recurring**: Monthly
   - **Price**: $7.00 USD
5. Click **Save product**
6. **Copy the Price ID** (starts with `price_`)

**Set up webhook:**

1. Go to: **Developers** → **Webhooks**
2. Click **+ Add endpoint**
3. Endpoint URL (local testing with Stripe CLI):
   ```
   http://localhost:3001/api/webhooks/stripe
   ```
4. Endpoint URL (production):
   ```
   https://api.convolab.app/api/webhooks/stripe
   ```
5. Select events to listen to:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.payment_succeeded`
6. Click **Add endpoint**
7. **Copy the Webhook signing secret** (starts with `whsec_`)

**Get your API keys:**

1. Go to: **Developers** → **API keys**
2. Copy **Publishable key** (starts with `pk_test_` or `pk_live_`)
3. Click **Reveal test key** or **Reveal live key**
4. Copy **Secret key** (starts with `sk_test_` or `sk_live_`)

**Update your .env file:**

```bash
# Test mode (for development)
STRIPE_SECRET_KEY=sk_test_your_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PRICE_PRO_MONTHLY=price_your_price_id

# Production (when ready to go live)
# STRIPE_SECRET_KEY=sk_live_your_secret_key
# STRIPE_PUBLISHABLE_KEY=pk_live_your_publishable_key
```

**Update client .env:**

Create `/client/.env.local`:

```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
```

---

### 3. Testing Locally

**Start your servers:**

Terminal 1 - Backend:

```bash
cd server
npm run dev
```

Terminal 2 - Frontend:

```bash
cd client
npm run dev
```

Terminal 3 - Stripe webhook listener (for testing Stripe):

```bash
stripe listen --forward-to localhost:3001/api/webhooks/stripe
```

**Test each flow:**

✅ **Email Verification:**

1. Create a test account at http://localhost:5173/login
2. Switch to "Sign Up" tab
3. Enter email, password, name, and invite code
4. Check server console for verification email (it won't actually send in dev)
5. Copy the verification link from console
6. Open the link to verify email

✅ **Password Reset:**

1. Go to http://localhost:5173/forgot-password
2. Enter your email
3. Check server console for reset link
4. Open the link and set new password

✅ **Google OAuth:**

1. Click "Continue with Google" on login page
2. Sign in with Google
3. If you don't have an invite code, you'll be redirected to `/claim-invite`
4. Enter an invite code to complete signup
5. Should redirect to `/app/library`

✅ **Stripe Checkout:**

1. Login to your account
2. Go to http://localhost:5173/pricing
3. Click "Upgrade to Pro" on the Pro tier
4. Complete checkout with test card: `4242 4242 4242 4242`
5. Any expiry date in the future, any CVC
6. Should redirect back and show Pro tier
7. Check Stripe dashboard to confirm subscription

✅ **Generation Quota:**

1. Try generating content (dialogue, course, etc.)
2. Should work if email is verified
3. Track your usage in Settings → Account
4. Free tier: 5 generations/week
5. Pro tier: 30 generations/week

---

### 4. Production Environment Variables

Once testing is complete, update your production environment:

**Backend (Cloud Run):**

```bash
# Email (Resend)
RESEND_API_KEY=re_your_actual_key
EMAIL_FROM=ConvoLab <noreply@convolab.app>

# Google OAuth
GOOGLE_CLIENT_ID=your-prod-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-prod-secret
GOOGLE_CALLBACK_URL=https://api.convolab.app/api/auth/google/callback

# Stripe (LIVE keys)
STRIPE_SECRET_KEY=sk_live_your_live_secret
STRIPE_PUBLISHABLE_KEY=pk_live_your_live_publishable
STRIPE_WEBHOOK_SECRET=whsec_your_prod_webhook_secret
STRIPE_PRICE_PRO_MONTHLY=price_your_prod_price_id

# Client URL
CLIENT_URL=https://convolab.app
```

**Frontend:**

```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_live_publishable
```

---

### 5. Deploy to Production

**Build and deploy backend:**

```bash
cd server
npm run build
./deploy.sh
```

**Build and deploy frontend:**

```bash
cd client
npm run build
# Deploy dist/ to your hosting (Vercel, Netlify, etc.)
```

---

## Support & Troubleshooting

**Common Issues:**

1. **"Email not verified" error when generating:**
   - Check database: your emailVerified should be `true`
   - Run: `DATABASE_URL="..." npx tsx check-email-verified.ts`

2. **Stripe webhook not working:**
   - Make sure webhook secret matches in .env
   - Check Stripe dashboard → Webhooks → Recent events for errors
   - In development, use `stripe listen --forward-to localhost:3001/api/webhooks/stripe`

3. **Google OAuth redirect error:**
   - Verify callback URL in Google Cloud Console matches exactly
   - Check that GOOGLE_CALLBACK_URL in .env is correct
   - Must use HTTPS in production (not HTTP)

4. **Invite code flow not working:**
   - Make sure you have invite codes in the database
   - Check `/server/src/routes/auth.ts` claim-invite endpoint logs

---

## Next Steps

1. Complete setup tasks above
2. Test all flows locally
3. Update production environment variables
4. Deploy to production
5. Monitor for errors in first 24 hours
6. Create invite codes for beta users
7. (Optional) Set up Stripe billing alerts at $50, $100, $200

Good luck! 🚀
