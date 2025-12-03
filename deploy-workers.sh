#!/bin/bash

# Cloud Run Job Deployment Script for ConvoLab Workers
# This script deploys BullMQ workers as a Cloud Run Job

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 ConvoLab Worker Job Deployment${NC}"
echo ""

# Check if .env.production exists
if [ ! -f .env.production ]; then
  echo -e "${RED}Error: .env.production file not found${NC}"
  echo "Please create .env.production with required environment variables"
  exit 1
fi

# Load environment variables
export $(cat .env.production | grep -v '^#' | xargs)

# Set defaults
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-convolab-mvp}
REGION=${REGION:-us-central1}
JOB_NAME="convolab-workers"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${JOB_NAME}"

echo -e "${YELLOW}Deploying to project: $PROJECT_ID${NC}"
echo -e "${YELLOW}Region: $REGION${NC}"
echo -e "${YELLOW}Job name: $JOB_NAME${NC}"
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
gcloud config set project $PROJECT_ID

# Build environment variables string
ENV_VARS=""
while IFS='=' read -r key value; do
  # Skip comments and empty lines
  [[ $key =~ ^#.*$ ]] && continue
  [[ -z $key ]] && continue

  # Skip certain variables
  if [[ $key == "GOOGLE_APPLICATION_CREDENTIALS" ]] || [[ $key == "WORKER_JOB_NAME" ]] || [[ $key == "WORKER_EXECUTION_REGION" ]]; then
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

echo -e "${GREEN}Building worker Docker image with Cloud Build...${NC}"

# Build image with Cloud Build
gcloud builds submit \
  --config=cloudbuild-workers.yaml \
  --substitutions=_IMAGE_NAME=$IMAGE_NAME \
  --project=$PROJECT_ID

echo -e "${GREEN}Creating/updating Cloud Run Job...${NC}"

# Try to update first, create if doesn't exist
gcloud run jobs update $JOB_NAME \
  --image $IMAGE_NAME \
  --region $REGION \
  --memory 4Gi \
  --cpu 2 \
  --max-retries 0 \
  --task-timeout 3600 \
  --parallelism 1 \
  --set-env-vars "$ENV_VARS" \
  --project=$PROJECT_ID 2>/dev/null || \
gcloud run jobs create $JOB_NAME \
  --image $IMAGE_NAME \
  --region $REGION \
  --memory 4Gi \
  --cpu 2 \
  --max-retries 0 \
  --task-timeout 3600 \
  --parallelism 1 \
  --set-env-vars "$ENV_VARS" \
  --project=$PROJECT_ID

echo ""
echo -e "${GREEN}✅ Worker job deployed successfully!${NC}"
echo ""
echo -e "${YELLOW}Test the worker job:${NC}"
echo "gcloud run jobs execute $JOB_NAME --region $REGION --wait"
echo ""
echo -e "${YELLOW}View logs:${NC}"
echo "gcloud run jobs logs read $JOB_NAME --region $REGION --limit 100"
echo ""
echo -e "${GREEN}Done! 🎉${NC}"
