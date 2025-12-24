#!/bin/bash
set -e

echo "🔵 Setting up Stripe Production Products and Webhook..."
echo ""

# Check if STRIPE_SECRET_KEY is provided as environment variable
if [ -z "$STRIPE_SECRET_KEY" ]; then
  echo "📝 You need your Stripe Live Mode Secret Key to continue."
  echo ""
  echo "To get it:"
  echo "1. Go to: https://dashboard.stripe.com/apikeys"
  echo "2. Make sure you're in LIVE mode (toggle in top-right)"
  echo "3. Click 'Reveal' on the 'Secret key' (starts with sk_live_)"
  echo "4. Copy the key"
  echo ""
  read -p "Paste your Secret Key here: " STRIPE_SECRET_KEY
  echo ""
fi

# Get publishable key from config
LIVE_PUB_KEY=$(stripe config --list | grep live_mode_pub_key | awk -F"'" '{print $2}')

echo "📦 Creating ConvoLab Test Product (\$0.01/month)..."
TEST_PRODUCT_JSON=$(STRIPE_API_KEY=$STRIPE_SECRET_KEY stripe products create \
  --name "ConvoLab Test" \
  --description "Test tier for internal testing - do not use for real customers" \
  2>&1)

if echo "$TEST_PRODUCT_JSON" | grep -q "error"; then
  echo "❌ Error creating product:"
  echo "$TEST_PRODUCT_JSON"
  exit 1
fi

TEST_PRODUCT_ID=$(echo "$TEST_PRODUCT_JSON" | grep '"id":' | head -1 | sed 's/.*"id": "\([^"]*\)".*/\1/')
echo "✅ Test Product created: $TEST_PRODUCT_ID"

echo ""
echo "💰 Creating Test Price (\$0.01/month recurring)..."
TEST_PRICE_JSON=$(STRIPE_API_KEY=$STRIPE_SECRET_KEY stripe prices create \
  --product "$TEST_PRODUCT_ID" \
  --unit-amount 1 \
  --currency usd \
  -d "recurring[interval]=month" \
  2>&1)

TEST_PRICE_ID=$(echo "$TEST_PRICE_JSON" | grep '"id":' | head -1 | sed 's/.*"id": "\([^"]*\)".*/\1/')
echo "✅ Test Price created: $TEST_PRICE_ID"

echo ""
echo "📦 Creating ConvoLab Pro Product (\$7/month)..."
PRO_PRODUCT_JSON=$(STRIPE_API_KEY=$STRIPE_SECRET_KEY stripe products create \
  --name "ConvoLab Pro" \
  --description "Premium tier with 30 generations per week" \
  2>&1)

PRO_PRODUCT_ID=$(echo "$PRO_PRODUCT_JSON" | grep '"id":' | head -1 | sed 's/.*"id": "\([^"]*\)".*/\1/')
echo "✅ Pro Product created: $PRO_PRODUCT_ID"

echo ""
echo "💰 Creating Pro Price (\$7.00/month recurring)..."
PRO_PRICE_JSON=$(STRIPE_API_KEY=$STRIPE_SECRET_KEY stripe prices create \
  --product "$PRO_PRODUCT_ID" \
  --unit-amount 700 \
  --currency usd \
  -d "recurring[interval]=month" \
  2>&1)

PRO_PRICE_ID=$(echo "$PRO_PRICE_JSON" | grep '"id":' | head -1 | sed 's/.*"id": "\([^"]*\)".*/\1/')
echo "✅ Pro Price created: $PRO_PRICE_ID"

echo ""
echo "🔗 Creating Production Webhook Endpoint..."
WEBHOOK_JSON=$(STRIPE_API_KEY=$STRIPE_SECRET_KEY stripe webhook_endpoints create \
  --url "https://api.convolab.app/api/webhooks/stripe" \
  --description "ConvoLab Production Webhook" \
  --enabled-events customer.subscription.created \
  --enabled-events customer.subscription.updated \
  --enabled-events customer.subscription.deleted \
  --enabled-events invoice.payment_failed \
  2>&1)

WEBHOOK_ID=$(echo "$WEBHOOK_JSON" | grep '"id":' | head -1 | sed 's/.*"id": "\([^"]*\)".*/\1/')
WEBHOOK_SECRET=$(echo "$WEBHOOK_JSON" | grep '"secret":' | sed 's/.*"secret": "\([^"]*\)".*/\1/')
echo "✅ Webhook Endpoint created: $WEBHOOK_ID"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ STRIPE SETUP COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Environment Variables (Backend - Cloud Run):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY"
echo "STRIPE_PUBLISHABLE_KEY=$LIVE_PUB_KEY"
echo "STRIPE_WEBHOOK_SECRET=$WEBHOOK_SECRET"
echo "STRIPE_PRICE_PRO_MONTHLY=$PRO_PRICE_ID"
echo "STRIPE_PRICE_TEST_MONTHLY=$TEST_PRICE_ID"
echo ""
echo "📋 Environment Variables (Frontend - Build):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "VITE_STRIPE_PUBLISHABLE_KEY=$LIVE_PUB_KEY"
echo "VITE_STRIPE_PRICE_PRO_MONTHLY=$PRO_PRICE_ID"
echo "VITE_STRIPE_PRICE_TEST_MONTHLY=$TEST_PRICE_ID"
echo ""
echo "💾 Saving to .env.stripe-production for reference..."
cat > .env.stripe-production <<EOF
# Backend (Cloud Run)
STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY=$LIVE_PUB_KEY
STRIPE_WEBHOOK_SECRET=$WEBHOOK_SECRET
STRIPE_PRICE_PRO_MONTHLY=$PRO_PRICE_ID
STRIPE_PRICE_TEST_MONTHLY=$TEST_PRICE_ID

# Frontend (Build)
VITE_STRIPE_PUBLISHABLE_KEY=$LIVE_PUB_KEY
VITE_STRIPE_PRICE_PRO_MONTHLY=$PRO_PRICE_ID
VITE_STRIPE_PRICE_TEST_MONTHLY=$TEST_PRICE_ID
EOF

echo "✅ Saved to: .env.stripe-production"
echo ""
echo "📝 Next Steps:"
echo "1. Review the values above"
echo "2. Run: ./scripts/update-cloud-run-env.sh"
echo "3. Deploy backend and frontend"
echo "4. Test with test user and regular user"
echo ""
