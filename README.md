# ConvoLab

A modern, adult-friendly language-learning and dialogue-generation tool designed as a creative studio rather than a gamified app.

**Developed by:** Conversational Dynamics Consulting Group (CDCG)

## Features (MVP)

- **Dialogue Generation**: AI-powered natural dialogue creation from user stories
- **Multi-Voice Audio**: High-quality Neural2 voices with speed/pause variants
- **Flowline Visualization**: Abstract animated mascot for synced playback
- **Image Generation**: Context-aware images via Gemini/Nano Banana
- **Practice Mode**: Interactive speaking practice with hints (no judgment)
- **Export Support**: Future Anki integration

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- TailwindCSS
- Framer Motion
- WaveSurfer.js

### Backend
- Node.js + Express + TypeScript
- PostgreSQL + Prisma
- BullMQ (job queue)
- Google Cloud services:
  - Gemini 2.0 (dialogue generation)
  - Cloud Text-to-Speech (Neural2)
  - Cloud Storage

### Hosting
- Google Cloud Run
- Google Cloud SQL (PostgreSQL)

## Project Structure

```
convo-lab/
├── client/          # React frontend
├── server/          # Node.js backend
├── shared/          # Shared types and utilities
└── docs/            # Documentation
```

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Google Cloud account with:
  - Gemini API enabled
  - Cloud Text-to-Speech API enabled
  - Cloud Storage bucket created

### Environment Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables (see `.env.example` in server/)

4. Run database migrations:
   ```bash
   npm run db:migrate --workspace=server
   ```

5. Start development servers:
   ```bash
   npm run dev
   ```

## Development

- **Client**: http://localhost:5173
- **Server**: http://localhost:3001

### Testing Stripe Subscriptions Locally

To test subscription flows in local development:

1. **Start the Stripe webhook listener** (in a separate terminal):
   ```bash
   stripe listen --forward-to localhost:3001/api/webhooks/stripe
   ```

   This will output a webhook signing secret like `whsec_...` - copy this to your `.env`:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
   ```

2. **Set up test products in Stripe Dashboard** (Test mode):
   - Create a "ConvoLab Pro" product at $7/month
   - Create a "ConvoLab Test" product at $0.01/month (for testing)
   - Copy the price IDs to your `.env`:
     ```bash
     STRIPE_PRICE_PRO_MONTHLY=price_test_...
     STRIPE_PRICE_TEST_MONTHLY=price_test_...
     ```

3. **Enable test tier for a user**:
   - Log in to admin panel at `/admin`
   - Find the user and click to view details
   - Toggle "Enable Test User" to allow them to see the test tier

4. **Test the checkout flow**:
   - As a test user, go to `/pricing`
   - Click "Test Checkout" on the $0.01 tier
   - Use Stripe test card: `4242 4242 4242 4242`
   - Any future expiry date and any CVC

5. **Verify webhook events**:
   - Check the terminal running `stripe listen` for webhook events
   - Verify subscription status in Stripe Dashboard
   - Confirm user tier updated to "pro" in your database

## Language Support

Currently supports Japanese with extensible architecture for:
- Chinese (Mandarin)
- Romance languages
- Right-to-left languages

## License

MIT
