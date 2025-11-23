# Getting Started with ConvoLab

This guide will help you get ConvoLab running locally in the fastest way possible.

## Quick Start (Docker Compose - Recommended)

The easiest way to run the full stack locally.

### 1. Prerequisites
- Docker Desktop installed
- Google Cloud account (for API keys)

### 2. Get API Keys

**Gemini API Key:**
1. Visit https://aistudio.google.com/app/apikey
2. Create an API key
3. Copy it

**Google Cloud Service Account:**
1. Go to Google Cloud Console
2. Create service account with these roles:
   - Cloud Text-to-Speech User
   - Cloud Storage Object Admin
3. Download JSON key
4. Save as `server/gcloud-key.json`

**Create Storage Bucket:**
```bash
# Replace YOUR-PROJECT-ID
gsutil mb -l us-central1 gs://languageflow-storage-YOUR-PROJECT-ID
gsutil iam ch allUsers:objectViewer gs://languageflow-storage-YOUR-PROJECT-ID
```

### 3. Configure Environment

Create `.env` in project root:
```env
GEMINI_API_KEY=your-gemini-api-key-here
GOOGLE_CLOUD_PROJECT=your-project-id
GCS_BUCKET_NAME=languageflow-storage-your-project-id
```

### 4. Start Everything

```bash
# From project root
docker-compose up
```

This starts:
- PostgreSQL database
- Redis
- Backend server (port 3001)
- Frontend client (port 5173)

### 5. Initialize Database

In a new terminal:
```bash
docker-compose exec server npx prisma migrate dev --name init
```

### 6. Access the App

Open http://localhost:5173

Create an account and start creating dialogues!

## Manual Setup (Without Docker)

### 1. Install Dependencies

**System Requirements:**
- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- ffmpeg

```bash
# macOS
brew install postgresql@15 redis ffmpeg
brew services start postgresql@15
brew services start redis

# Create database
createdb languageflow
```

### 2. Install Node Packages

```bash
npm install
```

### 3. Configure Environment

Follow steps 2 & 3 from Docker setup above.

Also configure `server/.env`:
```bash
cp server/.env.example server/.env
```

Edit `server/.env` with your values.

### 4. Initialize Database

```bash
cd server
npx prisma generate
npx prisma migrate dev --name init
cd ..
```

### 5. Start Development Servers

```bash
# Start both client and server
npm run dev
```

Or in separate terminals:
```bash
# Terminal 1 - Server
npm run dev:server

# Terminal 2 - Client
npm run dev:client
```

Access:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- API health: http://localhost:3001/health

## Creating Your First Dialogue

### 1. Sign Up
- Go to http://localhost:5173
- Click "Sign Up"
- Create an account

### 2. Create Episode
- Click "Create New Episode"
- Enter a title (e.g., "Coffee Shop Conversation")
- Write a story in the source text area:

```
I went to a coffee shop yesterday and ordered a latte.
The barista was very friendly and we chatted about the weather.
It was a nice experience.
```

### 3. Configure Speakers
- Select target language: Japanese
- Select native language: English
- Add two speakers:
  - Speaker 1: Name "Yuki", Proficiency "Native", Tone "Casual"
  - Speaker 2: Name "Kenji", Proficiency "Native", Tone "Polite"

### 4. Generate Dialogue
- Click "Generate Dialogue"
- Wait 10-30 seconds for AI generation
- Review the generated conversation

### 5. Select Variations
- Each sentence has multiple variations
- Click on your preferred variation
- Or keep the default

### 6. Generate Audio
- Click "Generate Audio"
- Wait 30-90 seconds for TTS processing
- Audio will be synced with text

### 7. Playback
- Click "Play Episode"
- Watch as sentences highlight in sync with audio
- See the Flowline animation
- Control speed, pause, skip

### 8. Practice Mode
- Click "Practice"
- Listen to one speaker
- Speak the other speaker's lines
- Use hints when needed

## Understanding the Interface

### Studio Page
- Input area for your story
- Speaker configuration
- Dialogue generation controls
- Sentence variation selector

### Playback Page
- Audio player with waveform
- Synced sentence highlighting
- Flowline animation
- Speed controls
- Image carousel

### Practice Page
- Turn-based dialogue playback
- Hint system (first word, furigana, full text)
- Speaking prompts
- No judgment mode (encourages output)

### Library Page
- List of all your episodes
- Quick access to playback/practice
- Delete/edit options

## Tips for Best Results

### Writing Source Text
- Be specific and descriptive
- Include emotions and context
- 3-5 sentences works well
- Focus on realistic scenarios

### Speaker Configuration
- Match proficiency to your learning level
- Use "Native + Learner" for practice dialogues
- Mix tones for natural variety

### Dialogue Generation
- Generate multiple times if needed
- Variations give you learning options
- Save episodes for later review

### Audio Features
- Normal speed: everyday listening
- Slow speed: learning mode
- Pause mode: Pimsleur-style practice

## Troubleshooting

### "Database connection failed"
```bash
# Check PostgreSQL is running
brew services list | grep postgresql

# Start it
brew services start postgresql@15
```

### "Redis connection failed"
```bash
# Check Redis
brew services list | grep redis

# Start it
brew services start redis
```

### "Gemini API error"
- Check your API key in `.env`
- Verify quota at https://aistudio.google.com

### "TTS error"
- Check service account permissions
- Verify `gcloud-key.json` exists
- Check bucket name matches project

### Port already in use
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill

# Or port 5173
lsof -ti:5173 | xargs kill
```

## Next Steps

- Read [Architecture Documentation](./ARCHITECTURE.md)
- Explore the [API Documentation](./API.md)
- Check out the [Development Guide](./DEVELOPMENT.md)

## Need Help?

- Check the GitHub issues
- Review error logs in terminal
- Verify all environment variables are set

Enjoy learning languages with ConvoLab!
