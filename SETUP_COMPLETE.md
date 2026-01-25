# ✅ ConvoLab DigitalOcean Migration Setup Complete

All preparation work is done! Your repository is now configured for automated deployment using GitHub Actions.

## What Was Completed

### ✅ 1. Generated Secure Passwords

- **PostgreSQL password**: `REMOVED_POSTGRES_PASSWORD`
- **Redis password**: `REMOVED_REDIS_PASSWORD`

These passwords are already set in:

- `.env.production` (root directory)
- `server/.env.production`

### ✅ 2. Created Docker Configuration

- **docker-compose.prod.yml**: Orchestrates all 6 services with proper memory limits and health checks
- Images will be pulled from GitHub Container Registry (ghcr.io)

### ✅ 3. Set Up GitHub Actions CI/CD

- **.github/workflows/deploy.yml**: Automatic build and deployment on every push to `main`
- Builds 4 Docker images in parallel
- Pushes to GitHub Container Registry (free)
- SSH deployment to droplet
- Built-in health checks

### ✅ 4. Created Deployment Scripts

- **deploy.sh**: Manual deployment fallback
- **backup-convolab.sh**: Automated database backups

### ✅ 5. Updated Documentation

- **GITHUB_ACTIONS_SETUP.md**: Complete CI/CD setup guide
- **MIGRATION.md**: Detailed migration steps
- **MIGRATION_SUMMARY.md**: Quick reference
- **Caddyfile.snippet**: Reverse proxy configuration

---

## What You Need to Do Next

### Step 1: Configure GitHub Secrets (5 minutes)

Go to https://github.com/andrewlandry/convo-lab/settings/secrets/actions and add:

1. **DROPLET_HOST**

   ```
   health.andrewlandry.com
   ```

2. **DROPLET_USER**

   ```
   root
   ```

3. **DROPLET_SSH_KEY**
   ```bash
   # Copy your private SSH key:
   cat ~/.ssh/id_rsa
   # Or if using ed25519:
   cat ~/.ssh/id_ed25519
   ```
   Paste the entire key including `-----BEGIN` and `-----END` lines.

### Step 2: Prepare Droplet (30 minutes)

Follow **GITHUB_ACTIONS_SETUP.md** section "First-Time Deployment Steps":

1. Create directories on droplet
2. Clone repository to `/opt/convolab`
3. Copy environment files (`.env.production`, `server/.env.production`, `gcloud-key.json`)
4. Update Caddy configuration
5. Update DNS (A record for convolab.andrewlandry.com)
6. Migrate database from Cloud SQL

### Step 3: Deploy! (Automatic)

Once droplet is prepared:

```bash
cd /Users/andrewlandry/source/convo-lab
git add .
git commit -m "feat: initial DigitalOcean deployment"
git push origin main
```

GitHub Actions will automatically:

- Build all 4 Docker images (~5 minutes)
- Push to GitHub Container Registry
- Deploy to droplet via SSH
- Run health checks

Monitor at: https://github.com/andrewlandry/convo-lab/actions

### Step 4: Verify (5 minutes)

```bash
# Check health endpoint
curl https://convolab.andrewlandry.com/health

# Check containers
ssh root@health.andrewlandry.com 'cd /opt/convolab && docker-compose -f docker-compose.prod.yml ps'
```

### Step 5: Clean Up Old Infrastructure

Once verified working:

1. **Decommission GCP** (see MIGRATION.md Phase 6)
   - Delete Cloud Run services
   - Delete Cloud SQL instance (after final backup!)
   - Keep GCS bucket (still in use)

2. **Cancel Upstash Redis subscription**

---

## How GitHub Actions Deployment Works

### Workflow Trigger

```
Push to main → GitHub Actions starts
```

### Build Phase (3-5 minutes)

```
[Parallel builds of 4 images]
├── convolab-server   (Node.js + React frontend)
├── convolab-worker   (BullMQ background jobs)
├── convolab-furigana (Python microservice)
└── convolab-pinyin   (Python microservice)
       ↓
[Push to ghcr.io/andrewlandry/*]
```

### Deploy Phase (1-2 minutes)

```
SSH to droplet
    ↓
Pull latest code from GitHub
    ↓
Login to GitHub Container Registry
    ↓
Pull new Docker images
    ↓
Restart containers with new images
    ↓
Health check
    ↓
✅ Deployment complete!
```

---

## Cost Summary

| Service   | Previous       | New                | Savings       |
| --------- | -------------- | ------------------ | ------------- |
| Compute   | GCP $30/mo     | DO $24/mo (shared) | +$6           |
| Redis     | Upstash $10/mo | Self-hosted $0     | +$10          |
| Storage   | Included       | GCS $1-3/mo        | -$1-3         |
| CI/CD     | None           | GitHub Actions $0  | $0            |
| **Total** | **$40/mo**     | **$25-27/mo**      | **$13-15/mo** |

**Annual savings**: $156-180/year (33-38% reduction)

---

## Important Files Reference

### Environment (Not in Git)

- `.env.production` - Docker Compose variables
- `server/.env.production` - Application config
- `server/gcloud-key.json` - GCS service account key

### Configuration (In Git)

- `docker-compose.prod.yml` - Container orchestration
- `.github/workflows/deploy.yml` - CI/CD pipeline
- `Caddyfile.snippet` - Reverse proxy config

### Deployment

- `deploy.sh` - Manual deployment fallback
- `backup-convolab.sh` - Database backup automation

### Documentation

- `GITHUB_ACTIONS_SETUP.md` - **START HERE** for deployment
- `MIGRATION.md` - Detailed migration guide
- `MIGRATION_SUMMARY.md` - Quick reference

---

## Next Steps Checklist

- [ ] Add GitHub secrets (DROPLET_HOST, DROPLET_USER, DROPLET_SSH_KEY)
- [ ] Prepare droplet (directories, Caddy, DNS)
- [ ] Migrate database from Cloud SQL
- [ ] Push to GitHub to trigger first deployment
- [ ] Verify deployment and health checks
- [ ] Set up automated backups (cron job)
- [ ] Decommission GCP services
- [ ] Cancel Upstash subscription

---

## Getting Help

- **GitHub Actions logs**: https://github.com/andrewlandry/convo-lab/actions
- **Droplet logs**: `ssh root@health.andrewlandry.com 'cd /opt/convolab && docker-compose logs'`
- **Health check**: `curl https://convolab.andrewlandry.com/health`
- **Troubleshooting**: See GITHUB_ACTIONS_SETUP.md

---

## Ready to Deploy?

Everything is set up and ready. Just follow **GITHUB_ACTIONS_SETUP.md** to:

1. Add GitHub secrets
2. Prepare droplet
3. Push to main
4. Watch it deploy automatically!

**No local Docker builds needed. No manual deployment steps. Just push and go!** 🚀
