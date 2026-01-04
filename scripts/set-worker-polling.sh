#!/bin/bash

# Script to adjust worker polling frequency on Cloud Run
# Usage: ./scripts/set-worker-polling.sh [delay-in-ms]
# Examples:
#   ./scripts/set-worker-polling.sh 5000     # Fast & responsive (recommended for fixed Upstash plan)
#   ./scripts/set-worker-polling.sh 30000    # Balanced (cost-effective for pay-as-you-go)
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
echo ""
echo "For Fixed Upstash Plan (\$10/mo with unlimited commands):"
echo "  5000ms (5s)     = Fast & responsive (recommended)"
echo "  30000ms (30s)   = Slower but still works"
echo ""
echo "For Pay-as-You-Go Upstash Plan (\$0.20 per 100K commands):"
echo "  30000ms (30s)   = ~17K cmds/day (~\$3-5/mo) - Balanced"
echo "  60000ms (60s)   = ~8.6K cmds/day - More efficient"
echo "  300000ms (5min) = ~1.7K cmds/day - Idle mode"
echo ""
echo "Current setting: ${DELAY}ms"
