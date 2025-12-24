#!/bin/bash
set -e

echo "☁️  Updating Cloud Run Environment Variables..."
echo ""

# Check if .env.stripe-production exists
if [ ! -f ".env.stripe-production" ]; then
  echo "❌ Error: .env.stripe-production not found"
  echo "   Run ./scripts/setup-stripe-production.sh first"
  exit 1
fi

# Source the environment variables
source .env.stripe-production

echo "📋 Environment variables to set:"
echo "  STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY:0:20}..."
echo "  STRIPE_PUBLISHABLE_KEY: ${STRIPE_PUBLISHABLE_KEY:0:20}..."
echo "  STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET:0:20}..."
echo "  STRIPE_PRICE_PRO_MONTHLY: $STRIPE_PRICE_PRO_MONTHLY"
echo "  STRIPE_PRICE_TEST_MONTHLY: $STRIPE_PRICE_TEST_MONTHLY"
echo ""

read -p "Update Cloud Run service 'convolab' with these values? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Aborted"
  exit 1
fi

echo ""
echo "🚀 Updating Cloud Run service..."

gcloud run services update convolab \
  --region=us-central1 \
  --update-env-vars \
STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY",\
STRIPE_PUBLISHABLE_KEY="$STRIPE_PUBLISHABLE_KEY",\
STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET",\
STRIPE_PRICE_PRO_MONTHLY="$STRIPE_PRICE_PRO_MONTHLY",\
STRIPE_PRICE_TEST_MONTHLY="$STRIPE_PRICE_TEST_MONTHLY"

echo ""
echo "✅ Cloud Run environment variables updated!"
echo ""
echo "🔍 Verifying..."
gcloud run services describe convolab \
  --region=us-central1 \
  --format="value(spec.template.spec.containers[0].env)" | grep STRIPE

echo ""
echo "✅ Done! The service will redeploy with new environment variables."
echo ""
echo "📝 Next Steps:"
echo "1. Update frontend environment variables (see .env.stripe-production)"
echo "2. Deploy frontend"
echo "3. Test in production"
echo ""
