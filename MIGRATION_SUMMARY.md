# ConvoLab DigitalOcean Migration - Implementation Summary

## What Was Created

This migration implementation includes all files needed to migrate ConvoLab from GCP + Upstash to your DigitalOcean droplet.

### Core Configuration Files

1. **docker-compose.prod.yml** - Docker Compose orchestration for all 6 services:
   - `postgres` - PostgreSQL 15 database (512MB limit)
   - `redis` - Redis 7 job queue (256MB limit)
   - `server` - Express API + React frontend (1GB limit)
   - `worker` - BullMQ background workers (1.5GB limit)
   - `furigana` - Japanese furigana microservice (256MB limit)
   - `pinyin` - Chinese pinyin microservice (256MB limit)

2. **.env.production** (root) - Docker Compose environment variables
   - PostgreSQL credentials (needs passwords generated)
   - Redis password (needs password generated)
   - Other shared secrets

3. **server/.env.production** - Application environment variables
   - Database URL pointing to `postgres:5432`
   - Redis connection to `redis:6379`
   - Service URLs updated for Docker network (`http://furigana:8080`, `http://pinyin:8081`)
   - GCS configuration (keeping existing GCS bucket)
   - All production API keys preserved

### Deployment & Operations Scripts

4. **deploy.sh** - Automated deployment script
   - SSH to droplet
   - Pull latest code from GitHub
   - Pull Docker images from Docker Hub
   - Restart containers
   - Run health checks
   - Support rollback: `./deploy.sh rollback <commit-sha>`

5. **backup-convolab.sh** - Database backup automation
   - Daily PostgreSQL backup via pg_dump
   - Compression to save space
   - Automatic cleanup (7-day retention)
   - Meant to run via cron: `0 2 * * * /opt/convolab/backup-convolab.sh`

6. **Caddyfile.snippet** - Caddy reverse proxy configuration
   - HTTPS termination with automatic certs
   - Security headers
   - Health check monitoring
   - Request logging
   - To be added to `/opt/health-tracker/Caddyfile` on droplet

### Documentation

7. **MIGRATION.md** - Complete step-by-step migration guide
   - Phase 1: Local preparation
   - Phase 2: Droplet setup (directories, Caddy, DNS)
   - Phase 3: Database migration (export from Cloud SQL, import to self-hosted)
   - Phase 4: Deploy ConvoLab (start containers)
   - Phase 5: Testing & validation
   - Phase 6: Cutover & decommission GCP
   - Troubleshooting guide
   - Post-migration monitoring

8. **GITHUB_ACTIONS_SETUP.md** - CI/CD automation guide
   - GitHub Actions workflow configuration
   - Secret management
   - Automated builds on push
   - Deployment workflow
   - Monitoring and troubleshooting

### Code Changes

9. **server/src/config/redis.ts** - Updated Redis config comments
   - Already handles TLS automatically (only enables for Upstash)
   - Works correctly with self-hosted Redis without TLS

## What You Need to Do Before Starting

### 1. Generate Strong Passwords

Generate two strong passwords:

```bash
# PostgreSQL password
openssl rand -base64 32

# Redis password
openssl rand -base64 32
```

### 2. Update Environment Files

Replace placeholders in both `.env.production` files:

- `/Users/andrewlandry/source/convo-lab/.env.production`
  - `CHANGE_THIS_GENERATE_STRONG_PASSWORD` (PostgreSQL)
  - `CHANGE_THIS_GENERATE_STRONG_PASSWORD` (Redis)

- `/Users/andrewlandry/source/convo-lab/server/.env.production`
  - `CHANGE_THIS_POSTGRES_PASSWORD`
  - `CHANGE_THIS_REDIS_PASSWORD`

### 3. Set Up GitHub Actions CI/CD

GitHub Actions will build and deploy automatically on every push to `main`. No local builds needed!

1. **Add GitHub Secrets** (one-time setup):
   - Go to https://github.com/andrewlandry/convo-lab/settings/secrets/actions
   - Add 3 secrets:
     - `DROPLET_HOST`: `health.andrewlandry.com`
     - `DROPLET_USER`: `root`
     - `DROPLET_SSH_KEY`: Your private SSH key (entire content of `~/.ssh/id_rsa` or `~/.ssh/id_ed25519`)

2. **Make Container Registry Public** (optional but recommended):
   - After first push, go to https://github.com/andrewlandry?tab=packages
   - For each package, click "Package settings" → "Change visibility" → "Public"

See `GITHUB_ACTIONS_SETUP.md` for detailed CI/CD setup instructions.

## Migration Phases

Follow the detailed guide in `MIGRATION.md` and `GITHUB_ACTIONS_SETUP.md`:

1. **Day 1**: Set up GitHub Actions + update passwords ✅ Ready to start
2. **Day 2**: Droplet setup + database migration
3. **Day 3**: Push to GitHub (triggers automatic deployment)
4. **Day 4-5**: Testing & validation
5. **Day 5**: Cutover & decommission GCP

## Quick Start

Once passwords are set and GitHub Actions configured:

1. **Set up GitHub Actions secrets** (see `GITHUB_ACTIONS_SETUP.md`)
   - DROPLET_HOST, DROPLET_USER, DROPLET_SSH_KEY

2. **Setup droplet**:

   ```bash
   ssh root@health.andrewlandry.com
   mkdir -p /opt/convolab-data/{postgres,redis,backups/{postgres,redis}}
   cd /opt
   git clone https://github.com/andrewlandry/convo-lab.git convolab
   ```

3. **Copy environment files and GCS key to droplet**

4. **Update Caddy configuration** (add Caddyfile.snippet)

5. **Update DNS** (A record: convolab.andrewlandry.com → droplet IP)

6. **Migrate database** (export from Cloud SQL, import to self-hosted)

7. **Deploy**: `git push origin main` (GitHub Actions handles the rest!)

## Architecture Overview

```
                                    ┌─────────────────┐
                                    │   Caddy Proxy   │
                                    │  (health-caddy) │
                                    │   HTTPS/SSL     │
                                    └────────┬────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
         ┌──────────▼─────────┐   ┌─────────▼────────┐   ┌──────────▼─────────┐
         │  Health Tracker    │   │  ConvoLab Server │   │  (Future apps...)  │
         │  health.andyland.. │   │  convolab.andy.. │   │                    │
         └────────────────────┘   └─────────┬────────┘   └────────────────────┘
                                             │
              ┌──────────────────────────────┼──────────────────────────────┐
              │                              │                              │
    ┌─────────▼────────┐         ┌──────────▼──────────┐      ┌───────────▼──────────┐
    │  convolab-worker │         │  convolab-postgres  │      │   convolab-redis     │
    │  (BullMQ jobs)   │         │  (PostgreSQL 15)    │      │   (Redis 7 queue)    │
    └──────────────────┘         └─────────────────────┘      └──────────────────────┘
              │
              │
    ┌─────────▼────────────────────────────────┐
    │  Language Processing Microservices       │
    │  ┌──────────────┐  ┌──────────────┐     │
    │  │  furigana    │  │  pinyin      │     │
    │  │  :8080       │  │  :8081       │     │
    │  └──────────────┘  └──────────────┘     │
    └───────────────────────────────────────────┘
```

## Memory Allocation

Total: ~3.8GB max (leaves ~200MB for system on 4GB droplet)

- **Server**: 512MB-1GB (API + frontend)
- **Worker**: 512MB-1.5GB (audio processing with ffmpeg)
- **Postgres**: 256MB-512MB (database)
- **Redis**: 256MB (job queue)
- **Furigana**: 256MB (Japanese text processing)
- **Pinyin**: 256MB (Chinese text processing)

## Cost Comparison

|           | Before (GCP)       | After (DigitalOcean) | Savings      |
| --------- | ------------------ | -------------------- | ------------ |
| Compute   | $30/mo (Cloud Run) | $0 (shared droplet)  | +$30         |
| Database  | Included in $30    | $0 (self-hosted)     | +$0          |
| Redis     | $10/mo (Upstash)   | $0 (self-hosted)     | +$10         |
| Storage   | $0 (included)      | $1-3/mo (GCS)        | -$1-3        |
| Droplet   | N/A                | $24/mo (shared)      | -$24         |
| **Total** | **$40/mo**         | **$27-31/mo**        | **$9-13/mo** |

**Annual savings**: $108-156/year (23-33% reduction)

## Next Steps

1. Review this summary
2. Read through MIGRATION.md for detailed steps
3. Generate passwords and update .env files
4. Build and push Docker images
5. Begin Phase 2 (Droplet Setup)

## Files Created

```
/Users/andrewlandry/source/convo-lab/
├── docker-compose.prod.yml          ← Main orchestration file
├── .env.production                  ← Docker Compose environment (UPDATE PASSWORDS!)
├── server/.env.production           ← Application environment (UPDATE PASSWORDS!)
├── deploy.sh                        ← Deployment automation (executable)
├── backup-convolab.sh              ← Backup automation (executable)
├── Caddyfile.snippet               ← Caddy config to add to droplet
├── MIGRATION.md                    ← Complete step-by-step guide (READ THIS!)
└── MIGRATION_SUMMARY.md            ← This file
```

## Rollback Safety

- GCP services stay running during migration
- Database backups before import
- Deploy script includes rollback: `./deploy.sh rollback <commit>`
- DNS can be reverted immediately
- No data loss risk if following guide

---

**Ready to start?** Open `MIGRATION.md` and begin with Phase 1.
