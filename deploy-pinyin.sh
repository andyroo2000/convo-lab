#!/bin/bash

# Deploy Pinyin Service to Cloud Run

set -e

PROJECT_ID="convolab-mvp"
REGION="us-central1"
SERVICE_NAME="convolab-pinyin"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"

echo -e "\033[0;32m🚀 Pinyin Service Deployment\033[0m"
echo ""
echo -e "\033[1;33mDeploying to project: ${PROJECT_ID}\033[0m"
echo -e "\033[1;33mRegion: ${REGION}\033[0m"
echo -e "\033[1;33mService name: ${SERVICE_NAME}\033[0m"
echo ""

# Build and push Docker image using Cloud Build
echo -e "\033[0;36m📦 Building pinyin service image with Cloud Build...\033[0m"
gcloud builds submit \
  --config=cloudbuild-pinyin.yaml \
  --project="${PROJECT_ID}"

# Deploy to Cloud Run
echo -e "\033[0;36m🚀 Deploying to Cloud Run...\033[0m"
gcloud run deploy "${SERVICE_NAME}" \
  --image="${IMAGE}" \
  --platform=managed \
  --region="${REGION}" \
  --allow-unauthenticated \
  --memory=512Mi \
  --cpu=1 \
  --timeout=60 \
  --min-instances=0 \
  --max-instances=10 \
  --project="${PROJECT_ID}"

# Get service URL
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(status.url)")

echo ""
echo -e "\033[0;32m✅ Pinyin service deployed successfully!\033[0m"
echo ""
echo -e "\033[0;32mService URL:\033[0m"
echo -e "\033[1;33m${SERVICE_URL}\033[0m"
echo ""
echo -e "\033[1;33mNext steps:\033[0m"
echo "1. Add to .env.production: PINYIN_SERVICE_URL=${SERVICE_URL}"
echo "2. Redeploy API service to pick up the new environment variable"
echo ""
