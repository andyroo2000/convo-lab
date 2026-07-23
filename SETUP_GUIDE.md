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

### 2. Testing Locally

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

✅ **Generation Quota:**

1. Try generating content (dialogue, course, etc.)
2. Should work if email is verified
3. The quota badge reports remaining monthly generations
4. Confirm the quota matches the canonical Learning OS account response

---

### 3. Production Environment Variables

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

# Client URL
CLIENT_URL=https://convolab.app
```

### 4. Deploy to Production

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

2. **Google OAuth redirect error:**
   - Verify callback URL in Google Cloud Console matches exactly
   - Check that GOOGLE_CALLBACK_URL in .env is correct
   - Must use HTTPS in production (not HTTP)

3. **Invite code flow not working:**
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

Good luck! 🚀
