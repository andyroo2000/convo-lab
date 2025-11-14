# LanguageFlow Studio - Setup Guide

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+ (for job queue)
- Docker & Docker Compose (optional, for containerized development)
- Google Cloud account with:
  - Gemini API enabled
  - Cloud Text-to-Speech API enabled
  - Cloud Storage bucket created
  - Service account with appropriate permissions

## Local Development Setup

### 1. Clone and Install

```bash
cd /Users/andrewlandry/source/experiments/languageflow-studio
npm install
```

This will install dependencies for all workspaces (client, server, shared).

### 2. Google Cloud Setup

#### Create Service Account
1. Go to Google Cloud Console
2. Create a new service account
3. Grant permissions:
   - Cloud Text-to-Speech User
   - Cloud Storage Object Admin
   - Vertex AI User (for Gemini)
4. Download JSON key and save as `server/gcloud-key.json`

#### Get Gemini API Key
1. Go to https://aistudio.google.com/app/apikey
2. Create API key
3. Save for `.env` file

#### Create Storage Bucket
```bash
gsutil mb -l us-central1 gs://languageflow-storage-[YOUR-PROJECT-ID]
gsutil iam ch allUsers:objectViewer gs://languageflow-storage-[YOUR-PROJECT-ID]
```

### 3. Database Setup

#### Option A: Local PostgreSQL
```bash
# Install PostgreSQL (macOS)
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb languageflow
```

#### Option B: Docker PostgreSQL
See Docker Compose setup below.

### 4. Redis Setup

#### Option A: Local Redis
```bash
# Install Redis (macOS)
brew install redis
brew services start redis
```

#### Option B: Docker Redis
See Docker Compose setup below.

### 5. Environment Configuration

Copy example env file and fill in values:

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:
```env
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL="postgresql://username:password@localhost:5432/languageflow?schema=public"

# Auth
JWT_SECRET=your-long-random-secret-here
COOKIE_SECRET=your-cookie-secret-here

# Google Cloud
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=./gcloud-key.json
GEMINI_API_KEY=your-gemini-api-key

# Google Cloud Storage
GCS_BUCKET_NAME=languageflow-storage-your-project-id

# TTS Voices (Neural2)
TTS_VOICE_JA_FEMALE=ja-JP-Neural2-B
TTS_VOICE_JA_MALE=ja-JP-Neural2-C

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Features
ENABLE_IMAGE_GENERATION=true
ENABLE_AUDIO_GENERATION=true
```

### 6. Database Migration

```bash
cd server
npx prisma generate
npx prisma migrate dev --name init
```

### 7. Start Development Servers

#### Terminal 1 - Server
```bash
npm run dev:server
```

#### Terminal 2 - Client
```bash
npm run dev:client
```

Or run both:
```bash
npm run dev
```

Access:
- Client: http://localhost:5173
- Server: http://localhost:3001
- Server health: http://localhost:3001/health

## Docker Compose Setup (Recommended for Development)

### 1. Create .env file

Create `.env` in project root:
```env
GEMINI_API_KEY=your-key
GOOGLE_CLOUD_PROJECT=your-project-id
GCS_BUCKET_NAME=your-bucket-name
```

### 2. Place Google Cloud credentials

Place `gcloud-key.json` in `server/` directory.

### 3. Start all services

```bash
docker-compose up
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)
- Server (port 3001)
- Client (port 5173)

### 4. Run migrations

```bash
docker-compose exec server npx prisma migrate dev
```

## Production Deployment to Google Cloud Run

### 1. Install Google Cloud SDK

```bash
brew install google-cloud-sdk
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### 2. Enable APIs

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
```

### 3. Create Cloud SQL Instance

```bash
gcloud sql instances create languageflow-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1

gcloud sql databases create languageflow \
  --instance=languageflow-db

gcloud sql users create languageflow \
  --instance=languageflow-db \
  --password=SECURE_PASSWORD_HERE
```

### 4. Create Redis Instance (Memorystore)

```bash
gcloud redis instances create languageflow-redis \
  --size=1 \
  --region=us-central1 \
  --redis-version=redis_7_0
```

### 5. Build and Deploy

```bash
gcloud builds submit --config cloudbuild.yaml
```

Or manually:

```bash
# Build
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/languageflow-server ./server
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/languageflow-client ./client

# Deploy server
gcloud run deploy languageflow-server \
  --image gcr.io/YOUR_PROJECT_ID/languageflow-server \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,DATABASE_URL=... \
  --set-cloudsql-instances YOUR_PROJECT_ID:us-central1:languageflow-db

# Deploy client
gcloud run deploy languageflow-client \
  --image gcr.io/YOUR_PROJECT_ID/languageflow-client \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated
```

## Troubleshooting

### Prisma Client Generation Issues
```bash
cd server
rm -rf node_modules/.prisma
npx prisma generate
```

### Port Already in Use
```bash
# Find process using port 3001
lsof -ti:3001 | xargs kill

# Or for 5173
lsof -ti:5173 | xargs kill
```

### Google Cloud Authentication
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/gcloud-key.json
```

### Database Connection Issues
```bash
# Check PostgreSQL is running
pg_isready

# Check database exists
psql -l | grep languageflow
```

## Next Steps

See:
- [Architecture Documentation](./ARCHITECTURE.md)
- [API Documentation](./API.md)
- [Development Guide](./DEVELOPMENT.md)
