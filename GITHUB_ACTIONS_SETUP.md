# GitHub Actions CI/CD Setup for ConvoLab

This guide explains how to set up automated deployment using GitHub Actions. Images are built on every push to `main`, deployed automatically to staging, and promoted to production with a manual workflow.

## Overview

**Benefits:**

- ✅ Free tier friendly (GitHub Actions: 2000 minutes/month)
- ✅ Automated builds on every push
- ✅ No local Docker builds needed
- ✅ GitHub Container Registry (ghcr.io) is free
- ✅ Consistent build environment
- ✅ Built-in health checks

**Workflow:**

1. Push code to `main` branch
2. GitHub Actions builds Docker images
3. Images are pushed to GitHub Container Registry (ghcr.io)
4. Staging deploy runs automatically
5. Production deploy is manual (workflow dispatch)

---

## One-Time Setup

### Step 1: Configure GitHub Secrets

You need to add these secrets to your GitHub repository:

1. Go to https://github.com/andrewlandry/convo-lab/settings/secrets/actions

2. Click "New repository secret" and add each:

#### DROPLET_HOST

```
health.andrewlandry.com
```

#### DROPLET_USER

```
root
```

#### DROPLET_SSH_KEY

This is your private SSH key that can access the droplet.

```bash
# On your Mac, copy your private key
cat ~/.ssh/id_rsa
# Or if you use a different key:
cat ~/.ssh/id_ed25519
```

Copy the entire output (including `-----BEGIN` and `-----END` lines) and paste it as the secret value.

#### GH_PAT

A GitHub Personal Access Token with `repo` read permissions so the droplet can `git fetch` private repos.

#### FISH_AUDIO_API_KEY

Used at deploy time to inject the audio API key into `.env.production` and `.env.staging`.

### Step 2: Make Container Registry Public (Optional but Recommended)

To avoid authentication issues, make your GitHub Container Registry packages public:

1. After first push, go to https://github.com/andrewlandry?tab=packages
2. Click on each package (convolab-server, convolab-worker, convolab-furigana, convolab-pinyin)
3. Click "Package settings"
4. Scroll down to "Danger Zone"
5. Click "Change visibility" → "Public"

**Note:** Making packages public is fine because:

- The images contain no secrets (secrets are in environment variables on the droplet)
- They're just application code
- It simplifies deployment (no auth needed to pull images)

### Step 3: Update Passwords in Environment Files

**IMPORTANT:** Before first deployment, update these files with strong passwords:

1. `.env.production` (root directory)
2. `server/.env.production`
3. `.env.staging` (root directory)
4. `server/.env.staging`

For both production and staging:
- Replace `CHANGE_THIS_GENERATE_STRONG_PASSWORD` for PostgreSQL
- Replace `CHANGE_THIS_GENERATE_STRONG_PASSWORD` for Redis
- Use separate passwords for staging vs production

Generate strong passwords:

```bash
# PostgreSQL password
openssl rand -base64 32

# Redis password
openssl rand -base64 32
```

**Security Note:** These files are in `.gitignore` so they won't be committed to GitHub. They only exist locally and on the droplet.

---

## Deployment Workflow

### Automatic Staging Deployment (Recommended)

1. Make your code changes locally
2. Commit and push to `main`:
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```
3. GitHub Actions automatically:
   - Builds 3 Docker images
   - Pushes to GitHub Container Registry
   - SSHs to droplet and deploys staging
   - Runs staging health checks

4. Monitor the deployment:
   - Go to https://github.com/andrewlandry/convo-lab/actions
   - Click on the latest workflow run
   - Watch the build and deploy logs in real-time

5. Deployment takes ~5-10 minutes total:
   - Build images: 3-5 minutes (parallel builds)
   - Deploy: 1-2 minutes
   - Health check: 30 seconds

### Manual Production Deployment

When you're ready to promote a staging build to production:

1. Go to https://github.com/andrewlandry/convo-lab/actions
2. Click "Deploy ConvoLab (Production)" workflow
3. Click "Run workflow"
4. Optional: set the image tag to `main-<sha>` to deploy the exact staging build

---

## First-Time Deployment Steps

Follow these steps for your initial deployment to the droplet:

### 1. Prepare Droplet

SSH to your droplet and set up directories:

```bash
ssh root@health.andrewlandry.com

# Create data directories
mkdir -p /opt/convolab-data/{postgres,redis,backups/{postgres,redis}}
mkdir -p /opt/convolab-data/stage/{postgres,redis,backups/{postgres,redis}}
chmod 700 /opt/convolab-data /opt/convolab-data/stage

# Clone repository
cd /opt
git clone https://github.com/andrewlandry/convo-lab.git convolab
cd convolab
```

### 2. Copy Environment Files and GCS Key

From your Mac:

```bash
# Copy .env.production
scp .env.production root@health.andrewlandry.com:/opt/convolab/

# Copy server/.env.production
scp server/.env.production root@health.andrewlandry.com:/opt/convolab/server/

# Copy .env.staging
scp .env.staging root@health.andrewlandry.com:/opt/convolab/

# Copy server/.env.staging
scp server/.env.staging root@health.andrewlandry.com:/opt/convolab/server/

# Copy GCS service account key
scp server/gcloud-key.json root@health.andrewlandry.com:/opt/convolab/server/
```

On the droplet, set permissions:

```bash
ssh root@health.andrewlandry.com
chmod 600 /opt/convolab/.env.production
chmod 600 /opt/convolab/server/.env.production
chmod 600 /opt/convolab/.env.staging
chmod 600 /opt/convolab/server/.env.staging
chmod 600 /opt/convolab/server/gcloud-key.json
```

### 3. Update Caddy Configuration

```bash
# On the droplet
cd /opt/health-tracker
nano Caddyfile
```

Add the contents from `Caddyfile.snippet` to the end of the file. This includes the staging domain with `X-Robots-Tag` and a `robots.txt` disallow. Then:

```bash
# Validate and reload
docker exec health-caddy caddy validate --config /etc/caddy/Caddyfile
docker exec health-caddy caddy reload --config /etc/caddy/Caddyfile
```

### 4. Update DNS

Add A records pointing to your droplet's IP address:

1. `convolab.andrewlandry.com`
2. `stage.convo-lab.com`

Wait 5-10 minutes for DNS propagation:

```bash
nslookup convolab.andrewlandry.com
```

### 5. Migrate Database

See MIGRATION.md Phase 3 for detailed database migration steps.

Quick version:

```bash
# Export from Cloud SQL (on your Mac)
gcloud sql export sql convolab-mvp-instance \
  gs://convolab-backups/migration-$(date +%Y%m%d).sql \
  --database=languageflow

# Download
gsutil cp gs://convolab-backups/migration-*.sql ~/Downloads/

# Copy to droplet
scp ~/Downloads/migration-*.sql root@health.andrewlandry.com:/opt/convolab/

# On droplet: start PostgreSQL and import
cd /opt/convolab
docker-compose -f docker-compose.prod.yml up -d postgres
docker exec -i convolab-postgres psql -U languageflow -d languageflow < migration-*.sql
```

### 6. Trigger First Deployment (Staging)

Push your code to trigger the first automated staging deployment:

```bash
# On your Mac
cd /Users/andrewlandry/source/convo-lab
git add .
git commit -m "feat: initial DigitalOcean deployment setup"
git push origin main
```

Watch the deployment at: https://github.com/andrewlandry/convo-lab/actions

### 7. Promote to Production (Manual)

1. Go to https://github.com/andrewlandry/convo-lab/actions
2. Select the "Deploy ConvoLab (Production)" workflow
3. Click "Run workflow"
4. Optional: enter `main-<sha>` to deploy the exact image you validated on staging

### 8. Verify Deployment

After GitHub Actions completes:

```bash
# Check health endpoint
curl https://convolab.andrewlandry.com/health

# Check containers on droplet
ssh root@health.andrewlandry.com 'cd /opt/convolab && docker-compose -f docker-compose.prod.yml ps'

# Check logs
ssh root@health.andrewlandry.com 'cd /opt/convolab && docker-compose -f docker-compose.prod.yml logs --tail=50'
```

---

## Troubleshooting

### Build Fails in GitHub Actions

**Check the logs:**

1. Go to https://github.com/andrewlandry/convo-lab/actions
2. Click on the failed run
3. Click on the failed job
4. Review error messages

**Common issues:**

- Missing dependencies in Dockerfile → Add them
- Build timeout → Builds should complete in <5 minutes each
- Out of memory → GitHub Actions runners have 7GB RAM, should be plenty

### Deployment Fails

**Check SSH access:**

```bash
# Test SSH from your Mac
ssh root@health.andrewlandry.com 'echo "SSH works"'
```

**Check GitHub secrets:**

- Verify DROPLET_SSH_KEY is correct (entire private key)
- Verify DROPLET_HOST and DROPLET_USER are correct

**Check droplet logs:**

```bash
ssh root@health.andrewlandry.com 'cd /opt/convolab && docker-compose -f docker-compose.prod.yml logs'
ssh root@health.andrewlandry.com 'cd /opt/convolab && docker-compose -f docker-compose.stage.yml logs'
```

### Health Check Fails

**Manual health check:**

```bash
curl -v https://convolab.andrewlandry.com/health
curl -v https://stage.convo-lab.com/health
```

**Common issues:**

- Caddy not configured → Check Caddyfile
- DNS not propagated → Wait 10-15 minutes
- Containers not running → Check `docker-compose ps`
- Port 3001 not exposed → Check docker-compose.prod.yml

### Cannot Pull Images from GitHub Container Registry

**If packages are private, droplet needs authentication:**

```bash
# On droplet
echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u andrewlandry --password-stdin
```

**Better solution:** Make packages public (see Step 2 above)

---

## Monitoring

### View Recent Deployments

https://github.com/andrewlandry/convo-lab/actions

### Check Droplet Status

```bash
# Container status
ssh root@health.andrewlandry.com 'cd /opt/convolab && docker-compose -f docker-compose.prod.yml ps'
ssh root@health.andrewlandry.com 'cd /opt/convolab && docker-compose -f docker-compose.stage.yml ps'

# Resource usage
ssh root@health.andrewlandry.com 'docker stats --no-stream'

# Recent logs
ssh root@health.andrewlandry.com 'cd /opt/convolab && docker-compose -f docker-compose.prod.yml logs --tail=100'
ssh root@health.andrewlandry.com 'cd /opt/convolab && docker-compose -f docker-compose.stage.yml logs --tail=100'
```

### Set Up Automated Backups

```bash
# On droplet
crontab -e

# Add this line:
0 2 * * * /opt/convolab/backup-convolab.sh >> /var/log/convolab-backup.log 2>&1
```

---

## Cost Analysis

| Service                   | Free Tier          | Usage         | Cost          |
| ------------------------- | ------------------ | ------------- | ------------- |
| GitHub Actions            | 2000 min/month     | ~50 min/month | $0            |
| GitHub Container Registry | Unlimited (public) | -             | $0            |
| DigitalOcean Droplet      | N/A                | 4GB shared    | $24/mo        |
| Google Cloud Storage      | 5GB free           | ~1GB          | $1-3/mo       |
| **Total**                 |                    |               | **$25-27/mo** |

**Previous costs:** $40/month (GCP $30 + Upstash $10)
**New costs:** $25-27/month
**Savings:** $13-15/month ($156-180/year or 33-38% reduction)

---

## Next Steps

1. ✅ Set up GitHub secrets (DROPLET_HOST, DROPLET_USER, DROPLET_SSH_KEY, GH_PAT, FISH_AUDIO_API_KEY)
2. ✅ Update passwords in .env.production and .env.staging files
3. ✅ Prepare droplet (directories, Caddy, DNS)
4. ✅ Migrate database from Cloud SQL
5. ✅ Push to main to trigger staging deployment
6. ✅ Run the production deploy workflow when ready
7. ✅ Verify deployment and health checks
8. ✅ Set up automated backups
9. ✅ Decommission GCP services

**Ready to deploy?** Just push to main and GitHub Actions handles the rest!
