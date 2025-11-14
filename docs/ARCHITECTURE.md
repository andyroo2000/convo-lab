# LanguageFlow Studio - Architecture Documentation

## System Overview

LanguageFlow Studio is a full-stack web application for language learning through AI-generated dialogues. The system consists of:

- **Frontend**: React SPA with TypeScript
- **Backend**: Node.js/Express REST API
- **Database**: PostgreSQL with Prisma ORM
- **Job Queue**: BullMQ with Redis
- **AI Services**: Google Gemini, Cloud TTS, Cloud Storage

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Client (Vite)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Studio Page  │  │Playback Page │  │Practice Page │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────┬────────────────────────────────────┘
                          │
                    REST API (HTTPS)
                          │
┌─────────────────────────┴────────────────────────────────────┐
│              Express.js Server (TypeScript)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Routes     │  │   Services   │  │ Job Workers  │      │
│  │ - Auth       │─▶│ - Dialogue   │  │ - Dialogue   │      │
│  │ - Episodes   │  │ - Audio      │  │ - Audio      │      │
│  │ - Dialogue   │  │ - Images     │  │ - Images     │      │
│  │ - Audio      │  │ - Language   │  │              │      │
│  │ - Images     │  │   Processor  │  └──────┬───────┘      │
│  └──────────────┘  └──────┬───────┘         │               │
│         │                  │                 │               │
│  ┌──────▼──────────────────▼─────────────────▼──────┐       │
│  │         PostgreSQL (Prisma ORM)                   │       │
│  │         Redis (BullMQ Queue)                      │       │
│  └───────────────────────────────────────────────────┘       │
└───────────────────┬──────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
┌───────▼────────┐   ┌─────────▼──────────┐
│ Google Gemini  │   │ Google Cloud       │
│ - Dialogue Gen │   │ - TTS (Neural2)    │
│ - Image Prompts│   │ - Storage (audio)  │
└────────────────┘   └────────────────────┘
```

## Data Flow

### 1. Dialogue Generation Flow

```
User Input (Story) → Studio Page
    ↓
Create Episode (POST /api/episodes)
    ↓
Generate Dialogue (POST /api/dialogue/generate)
    ↓
Job Queue (BullMQ) → Dialogue Worker
    ↓
Gemini API (Dialogue Generation)
    ↓
Language Processor (Furigana/Metadata)
    ↓
Save to Database (Dialogue, Sentences, Speakers)
    ↓
Return to Client → Display Variations
```

### 2. Audio Generation Flow

```
User Selects Sentences → Generate Audio
    ↓
POST /api/audio/generate
    ↓
Job Queue → Audio Worker
    ↓
For Each Sentence:
  - Google Cloud TTS (Neural2)
  - Generate MP3 audio
  - Calculate timing
    ↓
Concatenate Audio (ffmpeg)
    ↓
Upload to Google Cloud Storage
    ↓
Save URLs & Timings to Database
    ↓
Return to Client → Playback
```

### 3. Playback with Flowline Flow

```
Load Episode → Fetch Dialogue & Audio
    ↓
Initialize Audio Player (WaveSurfer.js)
    ↓
Load Sentence Timings
    ↓
Start Playback:
  - Play audio
  - Sync sentence highlighting (using timing data)
  - Animate Flowline (Canvas)
    ↓
User Controls:
  - Pause/Resume
  - Speed control
  - Skip to sentence
```

## Database Schema

### Core Tables

**User**
- id (UUID)
- email (unique)
- password (hashed)
- name
- timestamps

**Episode**
- id (UUID)
- userId (FK → User)
- title
- sourceText
- targetLanguage (language code)
- nativeLanguage
- status (draft | generating | ready | error)
- audioUrl
- timestamps

**Dialogue**
- id (UUID)
- episodeId (FK → Episode, unique)
- timestamps

**Speaker**
- id (UUID)
- dialogueId (FK → Dialogue)
- name
- voiceId (Google TTS voice)
- proficiency (beginner | intermediate | advanced | native)
- tone (casual | polite | formal)
- color (UI color)

**Sentence**
- id (UUID)
- dialogueId (FK → Dialogue)
- speakerId (FK → Speaker)
- order (int)
- text (target language)
- translation (native language)
- metadata (JSON - language-specific)
- audioUrl
- startTime, endTime (milliseconds)
- variations (JSON array)
- selected (boolean)
- timestamps

**Image**
- id (UUID)
- episodeId (FK → Episode)
- url
- prompt
- order
- sentenceStartId, sentenceEndId
- timestamp

### Language Metadata Structure

Stored as JSON in `Sentence.metadata`:

```json
{
  "japanese": {
    "kanji": "今日は天気が良いです",
    "kana": "きょうはてんきがいいです",
    "furigana": "今日[きょう]は天気[てんき]が良[い]いです"
  }
}
```

For Chinese:
```json
{
  "chinese": {
    "characters": "今天天气很好",
    "pinyin": "jīntiān tiānqì hěn hǎo"
  }
}
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Episodes
- `GET /api/episodes` - List user's episodes
- `GET /api/episodes/:id` - Get episode with dialogue
- `POST /api/episodes` - Create new episode
- `PATCH /api/episodes/:id` - Update episode
- `DELETE /api/episodes/:id` - Delete episode

### Dialogue
- `POST /api/dialogue/generate` - Start dialogue generation job
- `GET /api/dialogue/job/:jobId` - Check job status

### Audio
- `POST /api/audio/generate` - Start audio generation job
- `GET /api/audio/job/:jobId` - Check job status

### Images
- `POST /api/images/generate` - Start image generation job
- `GET /api/images/job/:jobId` - Check job status

## Job Queue Architecture

Uses BullMQ with Redis for background processing of long-running tasks.

### Queues

1. **dialogue-generation**
   - Processes: Gemini API calls, language processing
   - Duration: 10-30 seconds

2. **audio-generation**
   - Processes: TTS generation, ffmpeg concatenation, upload
   - Duration: 30-120 seconds

3. **image-generation**
   - Processes: Image prompt generation, API calls
   - Duration: 15-60 seconds

### Worker Pattern

```typescript
const worker = new Worker('queue-name', async (job) => {
  // Update progress
  await job.updateProgress(10);

  // Do work
  const result = await doWork(job.data);

  // Update progress
  await job.updateProgress(100);

  return result;
});
```

## Language Processing Architecture

### Extensible Design

The language processor is designed to easily add new languages:

```typescript
// languageProcessor.ts
export async function processLanguageText(
  text: string,
  languageCode: string
): Promise<LanguageMetadata> {
  switch (languageCode) {
    case 'ja':
      return { japanese: await processJapanese(text) };
    case 'zh':
      return { chinese: await processChinese(text) };
    // Add new languages here
    default:
      return {};
  }
}
```

### Japanese Processing (Kuroshiro)

1. Convert kanji to hiragana (kana reading)
2. Generate bracket-style furigana
3. Return structured metadata

### Future Languages

To add a new language:
1. Create processor function (e.g., `processSpanish`)
2. Define metadata interface (e.g., `SpanishMetadata`)
3. Add to `LanguageMetadata` type
4. Update `processLanguageText` switch

## Google Cloud Services

### Gemini API
- Model: `gemini-2.0-flash-exp` (default)
- Use: Dialogue generation, image prompt creation
- Cost: ~$0.05-0.30 per 1K tokens

### Cloud Text-to-Speech
- Voices: Neural2 (highest quality)
- Japanese: `ja-JP-Neural2-B` (female), `ja-JP-Neural2-C` (male)
- Cost: $16 per 1M characters
- Features: SSML support, speed control, pauses

### Cloud Storage
- Bucket: Public read access
- Structure:
  - `/audio/{episodeId}-{type}.mp3`
  - `/images/{episodeId}-{index}.png`
- Cost: ~$0.02/GB storage, $0.12/GB egress

## Security Considerations

### Authentication
- JWT tokens in HTTP-only cookies
- bcrypt password hashing (10 rounds)
- 7-day token expiration

### API Protection
- CORS enabled for frontend domain only
- Rate limiting (TODO: implement)
- Request size limits (10MB)

### Data Privacy
- User episodes isolated by userId
- No public episode access
- Secure cookie settings in production

## Performance Optimization

### Frontend
- Code splitting by route
- React Query for API caching
- Lazy loading of heavy components (WaveSurfer, Flowline)

### Backend
- Database connection pooling (Prisma)
- Job queue for async operations
- Efficient database queries with includes

### Caching Strategy (Future)
- Redis cache for frequently accessed episodes
- CDN for static assets
- Browser caching for audio/images

## Monitoring & Logging

### Development
- Request logging middleware
- Prisma query logging
- Console error tracking

### Production (TODO)
- Google Cloud Logging
- Error tracking (Sentry)
- Performance monitoring
- Job queue metrics

## Deployment Architecture

### Google Cloud Run
- Serverless containers
- Auto-scaling (0-100 instances)
- Pay-per-use pricing
- Built-in load balancing

### Cloud SQL (PostgreSQL)
- Managed database
- Automatic backups
- High availability option

### Memorystore (Redis)
- Managed Redis
- Automatic failover
- VPC peering with Cloud Run

## Future Enhancements

1. **Real-time Practice Mode**
   - Speech recognition (Google Speech-to-Text)
   - Pronunciation feedback

2. **Advanced Image Generation**
   - Imagen API integration
   - Consistent character generation

3. **Anki Export**
   - CSV format
   - APKG generation with media

4. **Multi-language Support**
   - Chinese, Spanish, French, Arabic, Hebrew
   - RTL language support

5. **Collaborative Features**
   - Share episodes
   - Community dialogue library

6. **Mobile App**
   - React Native
   - Offline support
