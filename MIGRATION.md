# ConvoLab DigitalOcean Migration Guide

This guide walks you through migrating ConvoLab from Google Cloud Platform to your DigitalOcean droplet.

**Goal:** Consolidate from GCP ($30/mo) + Upstash ($10/mo) to DigitalOcean ($24/mo existing droplet) + GCS ($1-3/mo)

**Estimated Time:** 5 days (can be compressed to 2-3 days)

---

## Prerequisites

Before starting:

- [ ] DigitalOcean droplet running (health.andrewlandry.com)
- [ ] Docker and Docker Compose installed on droplet
- [ ] SSH access to droplet
- [ ] Docker Hub account (for storing images)
- [ ] GCS service account key (gcloud-key.json)

---

## Phase 1: Local Preparation (Day 1)

### 1.1 Generate Strong Passwords

Generate strong passwords for PostgreSQL and Redis:

```bash
# Generate PostgreSQL password
openssl rand -base64 32

# Generate Redis password
openssl rand -base64 32
```

### 1.2 Update Environment Variables

Edit `.env.production` at the root and replace placeholders:

```bash
cd /Users/andrewlandry/source/convo-lab
nano .env.production
```

Replace:

- `CHANGE_THIS_GENERATE_STRONG_PASSWORD` (2 places) with generated passwords

Also update `server/.env.production`:

- Replace `CHANGE_THIS_POSTGRES_PASSWORD` with PostgreSQL password
- Replace `CHANGE_THIS_REDIS_PASSWORD` with Redis password

### 1.3 Build Docker Images Locally

Build images on your Mac (sequentially to avoid memory issues):

```bash
cd /Users/andrewlandry/source/convo-lab

# Login to Docker Hub
docker login

# Build server image
docker build -t andrewlandry/convolab-server:latest -f Dockerfile .

# Build worker image
docker build -t andrewlandry/convolab-worker:latest -f server/Dockerfile.worker .

# Build furigana service
docker build -t andrewlandry/convolab-furigana:latest -f furigana-service/Dockerfile ./furigana-service

# Build pinyin service
docker build -t andrewlandry/convolab-pinyin:latest -f pinyin-service/Dockerfile ./pinyin-service

# Push to Docker Hub
docker push andrewlandry/convolab-server:latest
docker push andrewlandry/convolab-worker:latest
docker push andrewlandry/convolab-furigana:latest
docker push andrewlandry/convolab-pinyin:latest
```

### 1.4 Test Locally (Optional)

Test the docker-compose setup locally:

```bash
# Create local data directories
mkdir -p /tmp/convolab-data/{postgres,redis}

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check container status
docker-compose -f docker-compose.prod.yml ps

# Check logs
docker-compose -f docker-compose.prod.yml logs

# Test health endpoint
curl http://localhost:3001/health

# Stop when done
docker-compose -f docker-compose.prod.yml down
```

---

## Phase 2: Droplet Setup (Day 2)

### 2.1 Prepare Droplet Directories

SSH to the droplet and create necessary directories:

```bash
ssh root@health.andrewlandry.com

# Create data directories
mkdir -p /opt/convolab-data/{postgres,redis,backups/{postgres,redis}}
chmod 700 /opt/convolab-data

# Verify creation
ls -la /opt/convolab-data
```

### 2.2 Clone Repository

```bash
cd /opt
git clone https://github.com/andrewlandry/convo-lab.git convolab
cd convolab
git checkout main
```

### 2.3 Create Environment Files

Create `.env.production` on the droplet:

```bash
cd /opt/convolab
nano .env.production
```

Copy the contents from your local `.env.production` (with real passwords).

Create `server/.env.production`:

```bash
nano server/.env.production
```

Copy the contents from your local `server/.env.production` (with real passwords).

### 2.4 Add GCS Service Account Key

Copy your GCS service account key to the droplet:

```bash
# On your Mac
scp ~/path/to/gcloud-key.json root@health.andrewlandry.com:/opt/convolab/server/gcloud-key.json

# On the droplet, set permissions
ssh root@health.andrewlandry.com
chmod 600 /opt/convolab/server/gcloud-key.json
```

### 2.5 Update Caddy Configuration

Add the ConvoLab configuration to Caddy:

```bash
# On the droplet
cd /opt/health-tracker
nano Caddyfile
```

Add the contents from `Caddyfile.snippet` to the end of the file.

Validate and reload Caddy:

```bash
# Validate configuration
docker exec health-caddy caddy validate --config /etc/caddy/Caddyfile

# Reload Caddy
docker exec health-caddy caddy reload --config /etc/caddy/Caddyfile
```

### 2.6 Update DNS

Add an A record for `convolab.andrewlandry.com` pointing to your droplet's IP address.

Wait 5-10 minutes for DNS propagation, then verify:

```bash
nslookup convolab.andrewlandry.com
```

---

## Phase 3: Database Migration (Day 2-3)

### 3.1 Export from Cloud SQL

On your Mac, export the current production database:

```bash
# Export to GCS bucket
gcloud sql export sql convolab-mvp-instance \
  gs://convolab-backups/migration-$(date +%Y%m%d).sql \
  --database=languageflow

# Download to local machine
gsutil cp gs://convolab-backups/migration-*.sql ~/Downloads/
```

### 3.2 Start PostgreSQL Container

On the droplet, start just the PostgreSQL container:

```bash
ssh root@health.andrewlandry.com
cd /opt/convolab

# Start postgres only
docker-compose -f docker-compose.prod.yml up -d postgres

# Wait for it to be ready (check logs)
docker-compose -f docker-compose.prod.yml logs -f postgres
# Press Ctrl+C when you see "database system is ready to accept connections"

# Verify postgres is healthy
docker-compose -f docker-compose.prod.yml ps
```

### 3.3 Import Database

Transfer and import the SQL dump:

```bash
# From your Mac, copy SQL file to droplet
scp ~/Downloads/migration-*.sql root@health.andrewlandry.com:/opt/convolab/

# On the droplet, import the data
ssh root@health.andrewlandry.com
cd /opt/convolab

# Import (this may take a few minutes)
docker exec -i convolab-postgres psql -U languageflow -d languageflow < migration-*.sql
```

### 3.4 Verify Data Integrity

Check that data was imported correctly:

```bash
# On the droplet
docker exec -it convolab-postgres psql -U languageflow -d languageflow

# Run verification queries
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM episodes;
SELECT COUNT(*) FROM dialogues;
SELECT COUNT(*) FROM audio_files;

# Exit psql
\q
```

Compare these counts with your production database to ensure completeness.

### 3.5 Run Prisma Migrations

Apply any pending migrations:

```bash
# On the droplet
cd /opt/convolab

# Run migrations (this will also verify DATABASE_URL is correct)
docker-compose -f docker-compose.prod.yml run --rm server npx prisma migrate deploy
```

---

## Phase 4: Deploy ConvoLab (Day 3-4)

### 4.1 Pull Docker Images

```bash
# On the droplet
cd /opt/convolab

# Pull all images from Docker Hub
docker-compose -f docker-compose.prod.yml pull
```

### 4.2 Start All Services

```bash
# Start all containers
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# All containers should show "Up" status
```

### 4.3 Check Logs

Monitor logs for any errors:

```bash
# View all logs
docker-compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker-compose -f docker-compose.prod.yml logs -f server
docker-compose -f docker-compose.prod.yml logs -f worker
docker-compose -f docker-compose.prod.yml logs -f postgres
docker-compose -f docker-compose.prod.yml logs -f redis
```

Press Ctrl+C to stop following logs.

### 4.4 Health Checks

Verify all services are healthy:

```bash
# API health endpoint
curl https://convolab.andrewlandry.com/health

# Should return: {"status":"ok"}

# Database connection
docker exec convolab-server npx prisma db execute --stdin <<< "SELECT 1;"

# Redis connection
docker exec convolab-redis redis-cli -a $REDIS_PASSWORD ping
# Should return: PONG

# Furigana service (internal network)
docker exec convolab-server wget -qO- http://furigana:8080/health

# Pinyin service (internal network)
docker exec convolab-server wget -qO- http://pinyin:8081/health
```

### 4.5 Monitor Resource Usage

Check that memory usage is within limits:

```bash
# Real-time stats
docker stats

# Check specific limits
docker inspect convolab-server | grep -A 5 Memory
docker inspect convolab-worker | grep -A 5 Memory

# System memory
free -h
```

Expected memory usage:

- **server**: ~300-600MB
- **worker**: ~400-800MB (when active)
- **postgres**: ~100-200MB
- **redis**: ~20-50MB
- **furigana**: ~50-100MB
- **pinyin**: ~50-100MB

**Total**: ~1-2GB under normal load

---

## Phase 5: Testing & Validation (Day 4-5)

### 5.1 Functional Testing

Test critical user flows:

1. **Login**

   ```bash
   # Use test credentials from .env:
   # TEST_USER_EMAIL and TEST_USER_PASSWORD
   ```

2. **Create Episode**
   - Create a new dialogue episode
   - Verify it saves correctly

3. **Audio Generation**
   - Trigger audio generation job
   - Check worker logs to see job processing
   - Verify audio file is created in GCS

4. **Furigana/Pinyin**
   - Test Japanese text (should show furigana)
   - Test Chinese text (should show pinyin)

5. **Gemini API**
   - Generate AI content
   - Verify API calls work

6. **Storage**
   - Upload content
   - Verify files are saved to GCS
   - Check file URLs work

### 5.2 Performance Verification

Check response times:

```bash
# API response time
time curl https://convolab.andrewlandry.com/health

# Should be < 500ms
```

Monitor worker job processing:

```bash
# Watch worker logs
docker-compose -f docker-compose.prod.yml logs -f worker
```

### 5.3 Backup Testing

Test the backup script:

```bash
# On the droplet
cd /opt/convolab

# Make backup script executable
chmod +x backup-convolab.sh

# Run manual backup
./backup-convolab.sh

# Verify backup was created
ls -lh /opt/convolab-data/backups/postgres/

# Test restore (optional, in non-production environment)
# gunzip -c /opt/convolab-data/backups/postgres/latest.sql.gz | \
#   docker exec -i convolab-postgres psql -U languageflow -d languageflow
```

### 5.4 Setup Automated Backups

Add backup script to cron:

```bash
# On the droplet
crontab -e

# Add this line (runs daily at 2 AM):
0 2 * * * /opt/convolab/backup-convolab.sh >> /var/log/convolab-backup.log 2>&1
```

Verify cron job:

```bash
crontab -l
```

---

## Phase 6: Cutover (Day 5)

### 6.1 Final Verification

Before switching over, verify everything works:

```bash
# Health check
curl https://convolab.andrewlandry.com/health

# Test login and core functionality
# (Use browser or API client)
```

### 6.2 Update DNS (if needed)

If you haven't already, ensure `convolab.andrewlandry.com` points to your droplet IP.

Wait for DNS propagation:

```bash
# Check DNS
nslookup convolab.andrewlandry.com
```

### 6.3 Monitor New Production Environment

Watch logs closely for the first few hours:

```bash
# On the droplet
cd /opt/convolab

# Monitor all logs
docker-compose -f docker-compose.prod.yml logs -f

# Monitor resource usage
docker stats
```

### 6.4 Decommission GCP Services

**IMPORTANT: Only do this after confirming everything works!**

Export final backup before decommissioning:

```bash
# On your Mac
gcloud sql export sql convolab-mvp-instance \
  gs://convolab-backups/final-backup-$(date +%Y%m%d).sql \
  --database=languageflow

# Download for safekeeping
gsutil cp gs://convolab-backups/final-backup-*.sql ~/Backups/
```

Stop and delete GCP services:

```bash
# Delete Cloud Run services
gcloud run services delete convolab-server --region us-central1 --quiet
gcloud run services delete furigana --region us-central1 --quiet
gcloud run services delete convolab-pinyin --region us-central1 --quiet
gcloud run jobs delete convolab-workers --region us-central1 --quiet

# Delete Cloud SQL instance (CAREFUL!)
gcloud sql instances delete convolab-mvp-instance --quiet

# KEEP GCS bucket (still in use):
# gs://convolab-storage
```

### 6.5 Cancel Upstash Redis

1. Login to [Upstash Console](https://console.upstash.com)
2. Delete `bursting-flounder-33054` database
3. Cancel subscription if needed

---

## Rollback Plan

If issues arise, you can rollback:

### Option 1: DNS Rollback (Immediate)

Point DNS back to old Cloud Run URL (if services still running).

### Option 2: Code Rollback

```bash
# On the droplet
cd /opt/convolab

# Reset to previous commit
./deploy.sh rollback <commit-sha>
```

### Option 3: Full Rollback to GCP

1. Keep GCP services running for 7 days during migration
2. If major issues, revert DNS to Cloud Run
3. Restore Cloud SQL from backup if needed

---

## Post-Migration

### Daily Monitoring

Check these daily for the first week:

```bash
# Container health
ssh root@health.andrewlandry.com 'cd /opt/convolab && docker-compose -f docker-compose.prod.yml ps'

# Resource usage
ssh root@health.andrewlandry.com 'docker stats --no-stream'

# Recent errors
ssh root@health.andrewlandry.com 'cd /opt/convolab && docker-compose -f docker-compose.prod.yml logs --tail=100 | grep -i error'

# Backup status
ssh root@health.andrewlandry.com 'ls -lh /opt/convolab-data/backups/postgres/'
```

### Weekly Tasks

- [ ] Verify backups are running
- [ ] Check disk space: `df -h`
- [ ] Review error logs
- [ ] Monitor costs (DigitalOcean + GCS)

### Monthly Tasks

- [ ] Test database restore procedure
- [ ] Review and optimize Docker images
- [ ] Check for security updates
- [ ] Verify all functionality still works

---

## Verification Checklist

After migration, verify:

- [ ] All 6 containers running: `docker ps`
- [ ] Health endpoint returns 200: `curl https://convolab.andrewlandry.com/health`
- [ ] Database connection working
- [ ] Redis connection working
- [ ] Furigana service responding
- [ ] Pinyin service responding
- [ ] Audio generation completes successfully
- [ ] Gemini API integration working
- [ ] GCS storage accessible
- [ ] Backups running and succeeding
- [ ] Memory usage < 70% under load
- [ ] No critical errors in logs
- [ ] HTTPS certificate valid
- [ ] DNS resolving correctly
- [ ] Can login with test credentials
- [ ] Can create new episodes
- [ ] Can generate audio files
- [ ] Can generate AI content

---

## Deployment Workflow (After Migration)

For future deployments:

### On Your Mac

```bash
cd /Users/andrewlandry/source/convo-lab

# Make code changes, test locally...

# Rebuild and push images
docker build -t andrewlandry/convolab-server:latest -f Dockerfile .
docker push andrewlandry/convolab-server:latest

# Or if worker changed:
docker build -t andrewlandry/convolab-worker:latest -f server/Dockerfile.worker .
docker push andrewlandry/convolab-worker:latest

# Commit and push code
git add .
git commit -m "Your changes"
git push origin main

# Deploy to droplet
./deploy.sh
```

The deploy script will:

1. SSH to droplet
2. Pull latest code from GitHub
3. Pull latest images from Docker Hub
4. Restart containers
5. Run health checks
6. Clean up old images

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs <service-name>

# Check config
docker-compose -f docker-compose.prod.yml config

# Restart specific service
docker-compose -f docker-compose.prod.yml restart <service-name>
```

### Database Connection Issues

```bash
# Check postgres is running
docker exec convolab-postgres pg_isready -U languageflow

# Test connection from server container
docker exec convolab-server sh -c 'nc -zv postgres 5432'

# Check DATABASE_URL
docker exec convolab-server env | grep DATABASE_URL
```

### Redis Connection Issues

```bash
# Check redis is running
docker exec convolab-redis redis-cli -a $REDIS_PASSWORD ping

# Test connection from server container
docker exec convolab-server sh -c 'nc -zv redis 6379'
```

### Out of Memory

```bash
# Check memory usage
free -h
docker stats

# Identify memory hog
docker stats --no-stream | sort -k 4 -h

# Restart worker if consuming too much
docker-compose -f docker-compose.prod.yml restart worker

# Consider upgrading droplet to 8GB
```

### Disk Space Issues

```bash
# Check disk usage
df -h

# Clean Docker cache
docker system prune -a -f

# Clean old logs
find /var/lib/docker/containers -name "*.log" -size +50M -delete

# Clean old backups
find /opt/convolab-data/backups -mtime +30 -delete
```

---

## Cost Tracking

### Current Costs (Post-Migration)

| Service        | Provider     | Monthly Cost |
| -------------- | ------------ | ------------ |
| 4GB Droplet    | DigitalOcean | $24.00       |
| Object Storage | Google Cloud | $1-3         |
| Gemini API     | Google Cloud | ~$1-2        |
| AWS Polly      | AWS          | ~$1-2        |
| **TOTAL**      |              | **$27-31**   |

### Savings

- **Before**: $40/month (GCP $30 + Upstash $10)
- **After**: $27-31/month
- **Savings**: $9-13/month ($108-156/year)
- **Reduction**: 23-33%

---

## Support

If you encounter issues:

1. Check logs: `docker-compose -f docker-compose.prod.yml logs -f`
2. Check this troubleshooting guide
3. Review the main migration plan for context
4. Test restore procedure if data is corrupted

Remember: You have backups! Don't panic.
