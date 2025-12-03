#!/bin/bash

# Deploy ConvoLab Worker Job to Cloud Run

set -e

PROJECT_ID="convolab-mvp"
REGION="us-central1"
JOB_NAME="convolab-workers"
IMAGE="gcr.io/${PROJECT_ID}/${JOB_NAME}:latest"

echo -e "\033[0;32m🚀 ConvoLab Worker Job Deployment\033[0m"
echo ""
echo -e "\033[1;33mDeploying to project: ${PROJECT_ID}\033[0m"
echo -e "\033[1;33mRegion: ${REGION}\033[0m"
echo -e "\033[1;33mJob name: ${JOB_NAME}\033[0m"
echo ""

# Build and push Docker image using Cloud Build
echo -e "\033[0;36m📦 Building worker image with Cloud Build...\033[0m"
gcloud builds submit \
  --config=cloudbuild-workers.yaml \
  --project="${PROJECT_ID}"

# Check if job exists
if gcloud run jobs describe "${JOB_NAME}" --region="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
  echo -e "\033[0;36m🔄 Updating existing Cloud Run Job...\033[0m"
  gcloud run jobs update "${JOB_NAME}" \
    --image="${IMAGE}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --env-vars-file=server/.env.production \
    --memory=4Gi \
    --cpu=2 \
    --max-retries=2 \
    --task-timeout=1h
else
  echo -e "\033[0;36m✨ Creating new Cloud Run Job...\033[0m"
  gcloud run jobs create "${JOB_NAME}" \
    --image="${IMAGE}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --env-vars-file=server/.env.production \
    --memory=4Gi \
    --cpu=2 \
    --max-retries=2 \
    --task-timeout=1h
fi

echo ""
echo -e "\033[0;32m✅ Worker job deployed successfully!\033[0m"
echo ""
echo -e "\033[1;33mTo manually trigger the worker job, run:\033[0m"
echo -e "  gcloud run jobs execute ${JOB_NAME} --region ${REGION} --wait"
echo ""
