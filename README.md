# ConvoLab

A modern, adult-friendly language-learning and dialogue-generation tool designed as a creative studio rather than a gamified app.

**Developed by:** Conversational Dynamics Consulting Group (CDCG)

## Features (MVP)

- **Dialogue Generation**: AI-powered natural dialogue creation from user stories
- **Multi-Voice Audio**: High-quality Neural2 voices with speed/pause variants
- **Flowline Visualization**: Abstract animated mascot for synced playback
- **Image Generation**: Context-aware images via Gemini/Nano Banana
- **Practice Mode**: Interactive speaking practice with hints (no judgment)
- **Export Support**: Future Anki integration

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- TailwindCSS
- Framer Motion
- WaveSurfer.js

### Backend
- Node.js + Express + TypeScript
- PostgreSQL + Prisma
- BullMQ (job queue)
- Google Cloud services:
  - Gemini 2.0 (dialogue generation)
  - Cloud Text-to-Speech (Neural2)
  - Cloud Storage

### Hosting
- Google Cloud Run
- Google Cloud SQL (PostgreSQL)

## Project Structure

```
convo-lab/
├── client/          # React frontend
├── server/          # Node.js backend
├── shared/          # Shared types and utilities
└── docs/            # Documentation
```

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Google Cloud account with:
  - Gemini API enabled
  - Cloud Text-to-Speech API enabled
  - Cloud Storage bucket created

### Environment Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables (see `.env.example` in server/)

4. Run database migrations:
   ```bash
   npm run db:migrate --workspace=server
   ```

5. Start development servers:
   ```bash
   npm run dev
   ```

## Development

- **Client**: http://localhost:5173
- **Server**: http://localhost:3001

## Language Support

Currently supports Japanese with extensible architecture for:
- Chinese (Mandarin)
- Romance languages
- Right-to-left languages

## License

MIT
