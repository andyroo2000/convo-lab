#!/bin/bash

# Cloud Run Deployment Script for ConvoLab
# This script simplifies the deployment process

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 ConvoLab Cloud Run Deployment${NC}"
echo ""

# Check if .env.production exists
if [ ! -f .env.production ]; then
  echo -e "${RED}Error: .env.production file not found${NC}"
  echo "Please create .env.production with required environment variables"
  echo "See DEPLOYMENT.md for details"
  exit 1
fi

# Load environment variables
export $(cat .env.production | grep -v '^#' | xargs)

# Prompt for project ID if not set
if [ -z "$GOOGLE_CLOUD_PROJECT" ]; then
  read -p "Enter your Google Cloud Project ID: " GOOGLE_CLOUD_PROJECT
fi

# Set default region
REGION=${REGION:-us-central1}
SERVICE_NAME=${SERVICE_NAME:-convolab}

echo -e "${YELLOW}Deploying to project: $GOOGLE_CLOUD_PROJECT${NC}"
echo -e "${YELLOW}Region: $REGION${NC}"
echo -e "${YELLOW}Service name: $SERVICE_NAME${NC}"
echo ""

# Confirm deployment
read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Deployment cancelled"
  exit 1
fi

# Set active project
echo -e "${GREEN}Setting active project...${NC}"
gcloud config set project $GOOGLE_CLOUD_PROJECT

# Build environment variables string for Cloud Run
ENV_VARS=""
while IFS='=' read -r key value; do
  # Skip comments and empty lines
  [[ $key =~ ^#.*$ ]] && continue
  [[ -z $key ]] && continue

  # Skip certain variables that shouldn't be in Cloud Run env
  if [[ $key == "GOOGLE_APPLICATION_CREDENTIALS" ]]; then
    continue
  fi

  # Remove quotes from value if present
  value="${value%\"}"
  value="${value#\"}"

  if [ -z "$ENV_VARS" ]; then
    ENV_VARS="$key=$value"
  else
    ENV_VARS="$ENV_VARS,$key=$value"
  fi
done < .env.production

echo -e "${GREEN}Building Docker image with Cloud Build (no cache)...${NC}"

# Load Stripe frontend env vars from .env.stripe-production if it exists
if [ -f .env.stripe-production ]; then
  echo -e "${YELLOW}Loading Stripe frontend environment variables...${NC}"
  export $(cat .env.stripe-production | grep "^VITE_" | xargs)
fi

# Build image with Cloud Build (no cache to force fresh build)
IMAGE_NAME="gcr.io/$GOOGLE_CLOUD_PROJECT/$SERVICE_NAME"
TIMESTAMP=$(date +%s)
gcloud builds submit --config=cloudbuild.yaml --substitutions=_CACHE_BUST=$TIMESTAMP,_IMAGE_NAME=$IMAGE_NAME,_VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY,_VITE_STRIPE_PRICE_PRO_MONTHLY=$VITE_STRIPE_PRICE_PRO_MONTHLY,_VITE_STRIPE_PRICE_TEST_MONTHLY=$VITE_STRIPE_PRICE_TEST_MONTHLY

echo -e "${GREEN}Deploying to Cloud Run...${NC}"

# Deploy to Cloud Run using the built image
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --min-instances 1 \
  --max-instances 10 \
  --add-cloudsql-instances convolab-mvp:us-central1:convolab-db \
  --set-env-vars "$ENV_VARS"

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --format="value(status.url)")

echo ""
echo -e "${GREEN}✅ Deployment successful!${NC}"
echo ""
echo -e "${GREEN}Your app is live at:${NC}"
echo -e "${YELLOW}$SERVICE_URL${NC}"
echo ""
echo -e "${YELLOW}Important next steps:${NC}"
echo "1. Update CLIENT_URL environment variable to: $SERVICE_URL"
echo "2. Test the health endpoint: $SERVICE_URL/health"
echo "3. Check logs: gcloud run services logs read $SERVICE_NAME --region $REGION"
echo ""

# Offer to update CLIENT_URL
read -p "Update CLIENT_URL environment variable now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${GREEN}Updating CLIENT_URL...${NC}"

  # Update ENV_VARS with new CLIENT_URL
  ENV_VARS=$(echo "$ENV_VARS" | sed "s|CLIENT_URL=[^,]*|CLIENT_URL=$SERVICE_URL|")

  gcloud run services update $SERVICE_NAME \
    --region $REGION \
    --set-env-vars "$ENV_VARS"

  echo -e "${GREEN}✅ CLIENT_URL updated${NC}"
fi

echo ""
echo -e "${GREEN}Done! 🎉${NC}"
