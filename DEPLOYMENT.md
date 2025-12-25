# Cloud Run Deployment Guide (MVP)

This guide covers deploying ConvoLab to Google Cloud Run for testing with friends.

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **gcloud CLI** installed ([install guide](https://cloud.google.com/sdk/docs/install))
3. **Docker** installed locally (for testing)

## Step 1: Set up Google Cloud Project

```bash
# Login to Google Cloud
gcloud auth login

# Create a new project (or use existing)
gcloud projects create convolab-mvp --name="ConvoLab MVP"

# Set as active project
gcloud config set project convolab-mvp

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  storage-api.googleapis.com \
  texttospeech.googleapis.com \
  cloudbuild.googleapis.com
```

## Step 2: Set up Cloud SQL (PostgreSQL)

```bash
# Create PostgreSQL instance (smallest tier for MVP)
gcloud sql instances create convolab-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --root-password=YOUR_STRONG_PASSWORD

# Create database
gcloud sql databases create languageflow --instance=convolab-db

# Create user
gcloud sql users create languageflow \
  --instance=convolab-db \
  --password=YOUR_DB_USER_PASSWORD

# Enable public IP and get connection details
gcloud sql instances describe convolab-db --format="value(ipAddresses[0].ipAddress)"
```

**Note the following for environment variables:**

- Database Host: (IP from above command)
- Database Name: `languageflow`
- Database User: `languageflow`
- Database Password: `YOUR_DB_USER_PASSWORD`

## Step 3: Set up Redis (Upstash - Free Tier)

Instead of Cloud Memorystore (requires VPC setup), use Upstash:

1. Go to [upstash.com](https://upstash.com)
2. Create a free account
3. Create a new Redis database
4. Select **Global** region for best latency
5. Note the connection details:
   - `REDIS_HOST` (endpoint without port)
   - `REDIS_PORT` (usually 6379)
   - `REDIS_PASSWORD` (from Upstash console)

**Alternative:** Use [Redis Cloud](https://redis.com/try-free/) free tier (200MB).

## Step 4: Prepare Environment Variables

Create a `.env.production` file locally (DO NOT commit this):

```bash
# Database
DATABASE_URL=postgresql://languageflow:YOUR_DB_USER_PASSWORD@YOUR_DB_IP:5432/languageflow?schema=public

# Redis (from Upstash)
REDIS_HOST=your-redis-endpoint.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your-upstash-password

# Authentication
JWT_SECRET=generate-a-long-random-string-here
COOKIE_SECRET=generate-another-long-random-string

# Google Cloud
GEMINI_API_KEY=your-gemini-api-key
GOOGLE_CLOUD_PROJECT=convolab-mvp
GCS_BUCKET_NAME=convolab-storage
GOOGLE_APPLICATION_CREDENTIALS=/app/gcloud-key.json

# TTS
TTS_VOICE_JA_FEMALE=ja-JP-Neural2-B
TTS_VOICE_JA_MALE=ja-JP-Neural2-C

# App Config
NODE_ENV=production
ENABLE_IMAGE_GENERATION=true
ENABLE_AUDIO_GENERATION=true

# Client URL (will be set after first deployment)
CLIENT_URL=https://your-app-url.run.app
```

## Step 5: Create GCS Bucket

```bash
# Create storage bucket
gsutil mb -p convolab-mvp -l us-central1 gs://convolab-storage

# Make bucket publicly readable (for serving audio/images)
gsutil iam ch allUsers:objectViewer gs://convolab-storage
```

## Step 6: Build and Deploy to Cloud Run

```bash
# Build and deploy with Cloud Build
gcloud run deploy convolab \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --min-instances 1 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production \
  --set-env-vars GEMINI_API_KEY=your-key \
  --set-env-vars GOOGLE_CLOUD_PROJECT=convolab-mvp \
  --set-env-vars GCS_BUCKET_NAME=convolab-storage \
  # ... add all other env vars from .env.production
```

**Or use the deployment script (recommended):**

```bash
# Make script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

## Step 7: Allow Cloud Run to Access Cloud SQL

```bash
# Get Cloud Run service account
SERVICE_ACCOUNT=$(gcloud run services describe convolab \
  --region us-central1 \
  --format='value(spec.template.spec.serviceAccountName)')

# Grant SQL Client role
gcloud projects add-iam-policy-binding convolab-mvp \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/cloudsql.client"
```

## Step 8: Update CLIENT_URL

After first deployment, get your Cloud Run URL:

```bash
gcloud run services describe convolab --region us-central1 --format="value(status.url)"
```

Update the `CLIENT_URL` environment variable:

```bash
gcloud run services update convolab \
  --region us-central1 \
  --set-env-vars CLIENT_URL=https://your-app-url.run.app
```

## Step 9: Run Database Migrations

Migrations run automatically on container startup (see Dockerfile CMD).

To manually run migrations:

```bash
# Connect to Cloud SQL
gcloud sql connect convolab-db --user=languageflow

# Or use Cloud Shell with Prisma CLI
gcloud run jobs create migrate-db \
  --image gcr.io/convolab-mvp/convolab \
  --command="npx" \
  --args="prisma,migrate,deploy"
```

## Testing Locally with Production Setup

```bash
# Build Docker image
docker build -t convolab:local .

# Run with production env vars
docker run -p 8080:8080 --env-file .env.production convolab:local
```

## Environment Variables Reference

| Variable                  | Description                  | Required           |
| ------------------------- | ---------------------------- | ------------------ |
| `DATABASE_URL`            | PostgreSQL connection string | Yes                |
| `REDIS_HOST`              | Redis hostname               | Yes                |
| `REDIS_PORT`              | Redis port                   | Yes                |
| `REDIS_PASSWORD`          | Redis password               | Yes (Upstash)      |
| `JWT_SECRET`              | Secret for JWT signing       | Yes                |
| `COOKIE_SECRET`           | Secret for cookie signing    | Yes                |
| `GEMINI_API_KEY`          | Google Gemini API key        | Yes                |
| `GOOGLE_CLOUD_PROJECT`    | GCP project ID               | Yes                |
| `GCS_BUCKET_NAME`         | Storage bucket name          | Yes                |
| `CLIENT_URL`              | Frontend URL for CORS        | Yes                |
| `NODE_ENV`                | Environment (production)     | Yes                |
| `ENABLE_IMAGE_GENERATION` | Enable image generation      | No (default: true) |
| `ENABLE_AUDIO_GENERATION` | Enable audio generation      | No (default: true) |

## Cost Estimates (Light Usage)

- **Cloud Run**: ~$5-15/month (mostly idle)
- **Cloud SQL (db-f1-micro)**: ~$7/month
- **Upstash Redis**: $0 (free tier)
- **Cloud Storage**: ~$1-5/month
- **Text-to-Speech API**: Pay-per-use (~$4 per 1M characters)
- **Gemini API**: Free tier, then pay-per-use

**Total: ~$15-30/month** for you and a few friends.

## Monitoring

```bash
# View logs
gcloud run services logs read convolab --region us-central1 --limit 50

# Monitor with Cloud Console
# https://console.cloud.google.com/run?project=convolab-mvp
```

## Troubleshooting

### Database Connection Issues

- Check Cloud SQL instance is running
- Verify DATABASE_URL is correct
- Ensure Cloud Run service account has SQL Client role

### Redis Connection Issues

- Verify Upstash credentials
- Check firewall rules allow outbound connections
- Test connection from Cloud Shell

### Build Failures

- Check Docker build locally first
- Review Cloud Build logs
- Ensure all environment variables are set

### 502/503 Errors

- Check container memory limits (increase if needed)
- Review timeout settings
- Check health endpoint: `https://your-url.run.app/health`

## Updating the App

```bash
# Redeploy with latest code
gcloud run deploy convolab \
  --source . \
  --region us-central1

# Or use deployment script
./deploy.sh
```

## Cleaning Up

To avoid charges when done testing:

```bash
# Delete Cloud Run service
gcloud run services delete convolab --region us-central1

# Delete Cloud SQL instance
gcloud sql instances delete convolab-db

# Delete storage bucket
gsutil rm -r gs://convolab-storage

# Delete entire project
gcloud projects delete convolab-mvp
```
