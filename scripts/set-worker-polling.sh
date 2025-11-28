#!/bin/bash

# Script to adjust worker polling frequency on Cloud Run
# Usage: ./scripts/set-worker-polling.sh [delay-in-ms]
# Examples:
#   ./scripts/set-worker-polling.sh 5000     # Fast (testing mode)
#   ./scripts/set-worker-polling.sh 30000    # Balanced
#   ./scripts/set-worker-polling.sh 300000   # Idle mode (5 minutes)

set -e

DELAY=${1:-30000}
SERVICE_NAME="convolab"
REGION="us-central1"

echo "Setting WORKER_DRAIN_DELAY to ${DELAY}ms for ${SERVICE_NAME}..."

# Update the environment variable
gcloud run services update ${SERVICE_NAME} \
  --region=${REGION} \
  --update-env-vars WORKER_DRAIN_DELAY=${DELAY}

echo "✅ Updated! Cloud Run will automatically restart with new setting."
echo ""
echo "Polling frequency guide:"
echo "  5000ms (5s)     = ~103K cmds/day (~\$15/mo) - Use for active testing"
echo "  30000ms (30s)   = ~17K cmds/day (~\$3-5/mo) - Balanced default"
echo "  60000ms (60s)   = ~8.6K cmds/day (free tier) - Efficient"
echo "  300000ms (5min) = ~1.7K cmds/day (minimal)   - Idle mode"
echo ""
echo "Current setting: ${DELAY}ms"
