#!/bin/bash

# ConvoLab Backup Script for DigitalOcean Droplet
# Performs daily PostgreSQL backup with automated cleanup
# Add to cron: 0 2 * * * /opt/convolab/backup-convolab.sh

set -e  # Exit on error

# Configuration
BACKUP_DIR="/opt/convolab-data/backups/postgres"
POSTGRES_CONTAINER="convolab-postgres"
POSTGRES_USER="languageflow"
POSTGRES_DB="languageflow"
RETENTION_DAYS=7  # Keep 7 daily backups
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/convolab_${DATE}.sql"

# Colors for output (work in cron logs)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🗄️  Starting ConvoLab PostgreSQL backup${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Backup file: ${BACKUP_FILE}"
echo "Timestamp: ${DATE}"
echo ""

# Check if container is running
if ! docker ps | grep -q $POSTGRES_CONTAINER; then
  echo -e "${RED}❌ Error: PostgreSQL container is not running${NC}"
  exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Perform backup
echo -e "${YELLOW}📦 Creating database dump...${NC}"
docker exec $POSTGRES_CONTAINER pg_dump -U $POSTGRES_USER $POSTGRES_DB > $BACKUP_FILE

# Check if backup was successful
if [ ! -f $BACKUP_FILE ]; then
  echo -e "${RED}❌ Error: Backup file was not created${NC}"
  exit 1
fi

# Get backup size
BACKUP_SIZE=$(du -h $BACKUP_FILE | cut -f1)
echo -e "${GREEN}✅ Backup created successfully (${BACKUP_SIZE})${NC}"

# Compress backup to save space
echo -e "${YELLOW}🗜️  Compressing backup...${NC}"
gzip $BACKUP_FILE
COMPRESSED_FILE="${BACKUP_FILE}.gz"
COMPRESSED_SIZE=$(du -h $COMPRESSED_FILE | cut -f1)
echo -e "${GREEN}✅ Backup compressed (${COMPRESSED_SIZE})${NC}"

# Create symlink to latest backup
ln -sf $(basename $COMPRESSED_FILE) ${BACKUP_DIR}/latest.sql.gz
echo -e "${GREEN}✅ Updated 'latest' symlink${NC}"

# Cleanup old backups
echo -e "\n${YELLOW}🧹 Cleaning up old backups (keeping last ${RETENTION_DAYS} days)...${NC}"
find $BACKUP_DIR -name "convolab_*.sql.gz" -mtime +$RETENTION_DAYS -type f -delete
REMAINING_BACKUPS=$(find $BACKUP_DIR -name "convolab_*.sql.gz" -type f | wc -l)
echo -e "${GREEN}✅ Cleanup complete (${REMAINING_BACKUPS} backups remaining)${NC}"

# Show backup list
echo -e "\n${YELLOW}📋 Current backups:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ls -lh $BACKUP_DIR/convolab_*.sql.gz | awk '{print $9, "\t", $5, "\t", $6, $7, $8}'
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Calculate total backup disk usage
TOTAL_SIZE=$(du -sh $BACKUP_DIR | cut -f1)
echo -e "\n${GREEN}Total backup disk usage: ${TOTAL_SIZE}${NC}"

echo -e "\n${GREEN}✅ Backup completed successfully${NC}"
echo ""
echo "To restore from this backup:"
echo "  gunzip -c ${COMPRESSED_FILE} | docker exec -i ${POSTGRES_CONTAINER} psql -U ${POSTGRES_USER} -d ${POSTGRES_DB}"
echo ""
echo "To restore from latest backup:"
echo "  gunzip -c ${BACKUP_DIR}/latest.sql.gz | docker exec -i ${POSTGRES_CONTAINER} psql -U ${POSTGRES_USER} -d ${POSTGRES_DB}"
