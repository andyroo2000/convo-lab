# Docker Setup Checklist

Follow these steps to get ConvoLab running with Docker Compose.

## ☐ Step 1: Get Google Cloud Credentials

### 1.1 Get Gemini API Key

1. Visit https://aistudio.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key

### 1.2 Create Google Cloud Service Account

1. Go to https://console.cloud.google.com
2. Select your project (or create a new one)
3. Go to "IAM & Admin" > "Service Accounts"
4. Click "Create Service Account"
5. Name it "languageflow-service"
6. Grant these roles:
   - Cloud Text-to-Speech User
   - Storage Object Admin
7. Click "Create Key" > JSON
8. Download the JSON file
9. Save it as `server/gcloud-key.json`

### 1.3 Create Storage Bucket

```bash
# Install Google Cloud SDK if not already installed
# brew install google-cloud-sdk

# Login
gcloud auth login

# Set project
gcloud config set project YOUR-PROJECT-ID

# Create bucket (replace YOUR-PROJECT-ID)
gsutil mb -l us-central1 gs://languageflow-storage-YOUR-PROJECT-ID

# Make bucket public-readable
gsutil iam ch allUsers:objectViewer gs://languageflow-storage-YOUR-PROJECT-ID
```

## ☐ Step 2: Configure Environment

### 2.1 Edit `.env` in project root

```bash
nano .env
```

Update these values:

```env
GEMINI_API_KEY=YOUR_ACTUAL_API_KEY
GOOGLE_CLOUD_PROJECT=your-project-id
GCS_BUCKET_NAME=languageflow-storage-your-project-id
```

### 2.2 Verify `server/gcloud-key.json` exists

```bash
ls -la server/gcloud-key.json
```

Should show the JSON file. If not, go back to step 1.2.

## ☐ Step 3: Install Docker

If you don't have Docker Desktop:

```bash
# macOS
brew install --cask docker

# Then open Docker Desktop from Applications
# Wait for it to start (whale icon in menu bar)
```

## ☐ Step 4: Start Docker Compose

```bash
# Make sure you're in the project root
cd /Users/andrewlandry/source/convo-lab

# Start all services (first time will download images)
docker-compose up
```

You should see:

- ✅ postgres: healthy
- ✅ redis: healthy
- ✅ server: starting
- ✅ client: starting

Leave this terminal running. Open a new terminal for next steps.

## ☐ Step 5: Initialize Database

In a **new terminal**:

```bash
cd /Users/andrewlandry/source/convo-lab

# Run Prisma migrations
docker-compose exec server npx prisma migrate dev --name init

# Verify database is set up
docker-compose exec server npx prisma studio
```

Prisma Studio will open at http://localhost:5555 - you should see empty tables.

## ☐ Step 6: Access the Application

Open your browser:

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001/health
- **Prisma Studio**: http://localhost:5555

## ☐ Step 7: Create Your First Account

1. Go to http://localhost:5173
2. Click "Sign Up"
3. Enter:
   - Name: Your name
   - Email: your@email.com
   - Password: password123
4. Click "Sign Up"
5. You should be redirected to the Library page

## ✅ Success!

If you see the Library page, everything is working!

## 🐛 Troubleshooting

### "Cannot connect to Docker daemon"

```bash
# Make sure Docker Desktop is running
open -a Docker

# Wait for it to start (whale icon in menu bar should be steady)
```

### "Port 5432 already in use"

```bash
# Stop local PostgreSQL
brew services stop postgresql@15

# Or change the port in docker-compose.yml
```

### "Port 6379 already in use"

```bash
# Stop local Redis
brew services stop redis
```

### "server exited with code 1"

```bash
# Check server logs
docker-compose logs server

# Common issues:
# - Missing .env values
# - Missing gcloud-key.json
# - Invalid Google Cloud credentials
```

### "Database connection failed"

```bash
# Wait for postgres to be healthy
docker-compose ps

# Should show "healthy" for postgres
# If not, restart:
docker-compose restart postgres

# Wait 10 seconds, then run migrations again
```

### Still having issues?

```bash
# Stop everything
docker-compose down

# Remove volumes (fresh start)
docker-compose down -v

# Start again
docker-compose up
```

## 📝 Useful Commands

```bash
# Stop all services
docker-compose down

# Start in detached mode (background)
docker-compose up -d

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f server

# Restart a service
docker-compose restart server

# Run commands in server container
docker-compose exec server npm run dev

# Access PostgreSQL
docker-compose exec postgres psql -U languageflow -d languageflow

# Access Redis CLI
docker-compose exec redis redis-cli
```
