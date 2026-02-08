#!/bin/bash

# ConvoLab Manual Deployment Script for DigitalOcean Droplet
# NOTE: Deployment is normally handled by GitHub Actions (.github/workflows/deploy.yml)
# This script is for manual deployment or emergency rollbacks
# Deploys ConvoLab to health.andrewlandry.com droplet alongside health app

set -e  # Exit on error

# Configuration
DROPLET_HOST="root@health.andrewlandry.com"
DEPLOY_DIR="/opt/convolab"
HEALTH_CHECK_URL="https://convo-lab.com/health"
HEALTH_CHECK_RETRIES=10
HEALTH_CHECK_INTERVAL=5

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Rollback function
rollback() {
  COMMIT_SHA=$1
  if [ -z "$COMMIT_SHA" ]; then
    echo -e "${RED}Error: No commit SHA provided for rollback${NC}"
    echo "Usage: ./deploy.sh rollback <commit-sha>"
    exit 1
  fi

  echo -e "${YELLOW}Rolling back to commit: $COMMIT_SHA${NC}"

  ssh $DROPLET_HOST << ENDSSH
set -e
cd $DEPLOY_DIR

# Reset to specified commit
git reset --hard $COMMIT_SHA

# Pull images for that version (assumes images were tagged)
docker-compose -f docker-compose.prod.yml pull

# Restart containers
docker-compose -f docker-compose.prod.yml up -d --force-recreate

echo "Rollback complete"
ENDSSH

  echo -e "${GREEN}✅ Rollback completed${NC}"
  exit 0
}

# Check for rollback command
if [ "$1" = "rollback" ]; then
  rollback "$2"
fi

echo -e "${GREEN}🚀 Starting ConvoLab deployment to DigitalOcean droplet${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Step 1: Get current commit SHA for potential rollback
echo -e "\n${YELLOW}📝 Saving current commit SHA for rollback...${NC}"
CURRENT_COMMIT=$(ssh $DROPLET_HOST "cd $DEPLOY_DIR && git rev-parse HEAD" 2>/dev/null || echo "none")
echo "Current deployed commit: ${CURRENT_COMMIT}"

# Step 2: SSH to droplet and pull latest code
echo -e "\n${YELLOW}📦 Pulling latest code from GitHub...${NC}"
ssh $DROPLET_HOST << 'ENDSSH'
set -e
cd /opt/convolab

# Pull latest changes
echo "Fetching latest changes..."
git fetch origin
git pull origin main

# Show latest commit
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Latest commit:"
git log -1 --oneline
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ENDSSH

# Step 3: Pull Docker images from Docker Hub
echo -e "\n${YELLOW}🐋 Pulling latest Docker images from Docker Hub...${NC}"
ssh $DROPLET_HOST << 'ENDSSH'
set -e
cd /opt/convolab

echo "Pulling images..."
docker-compose -f docker-compose.prod.yml pull
ENDSSH

# Step 4: Restart containers with new images
echo -e "\n${YELLOW}♻️  Restarting containers...${NC}"
ssh $DROPLET_HOST << 'ENDSSH'
set -e
cd /opt/convolab

# Restart with new images (recreate containers)
docker-compose -f docker-compose.prod.yml up -d --force-recreate

# Show container status
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker-compose -f docker-compose.prod.yml ps
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ENDSSH

# Step 5: Wait for services to be ready
echo -e "\n${YELLOW}⏳ Waiting for services to start...${NC}"
sleep 10

# Step 6: Health check
echo -e "\n${YELLOW}🏥 Running health checks...${NC}"
HEALTHY=false
for i in $(seq 1 $HEALTH_CHECK_RETRIES); do
  echo "Attempt $i/$HEALTH_CHECK_RETRIES: Checking $HEALTH_CHECK_URL"

  if curl -f -s -o /dev/null -w "%{http_code}" $HEALTH_CHECK_URL | grep -q "200"; then
    HEALTHY=true
    echo -e "${GREEN}✅ Health check passed!${NC}"
    break
  fi

  echo "Health check failed, retrying in ${HEALTH_CHECK_INTERVAL}s..."
  sleep $HEALTH_CHECK_INTERVAL
done

if [ "$HEALTHY" = false ]; then
  echo -e "\n${RED}❌ Health check failed after $HEALTH_CHECK_RETRIES attempts${NC}"
  echo "Deployment may have issues. Check logs with:"
  echo "  ssh $DROPLET_HOST 'cd $DEPLOY_DIR && docker-compose -f docker-compose.prod.yml logs'"
  echo ""
  echo "To rollback to previous version:"
  if [ "$CURRENT_COMMIT" != "none" ]; then
    echo "  ./deploy.sh rollback $CURRENT_COMMIT"
  else
    echo "  No previous commit found"
  fi
  exit 1
fi

# Step 7: Cleanup old Docker images
echo -e "\n${YELLOW}🧹 Cleaning up old Docker images...${NC}"
ssh $DROPLET_HOST << 'ENDSSH'
docker image prune -f
ENDSSH

# Step 8: Show recent logs
echo -e "\n${YELLOW}📋 Recent container logs:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ssh $DROPLET_HOST "cd $DEPLOY_DIR && docker-compose -f docker-compose.prod.yml logs --tail=20"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Success!
echo -e "\n${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo "🔗 Application: https://convo-lab.com"
echo "🏥 Health check: $HEALTH_CHECK_URL"
echo ""
echo "To view live logs:"
echo "  ssh $DROPLET_HOST 'cd $DEPLOY_DIR && docker-compose -f docker-compose.prod.yml logs -f'"
echo ""
echo "To rollback if needed:"
if [ "$CURRENT_COMMIT" != "none" ]; then
  echo "  ./deploy.sh rollback $CURRENT_COMMIT"
fi
