# ConvoLab

A modern, adult-friendly language-learning and dialogue-generation tool designed as a creative studio rather than a gamified app.

**Developed by:** Conversational Dynamics Consulting Group (CDCG)

## Features

### Content Creation

- **Dialogue Generation**: AI-powered natural dialogue creation from user input
- **Audio Courses**: Multi-episode immersive audio courses (up to 15 minutes)

### Learning Experience

- **Multi-Voice Audio**: High-quality Neural2 voices with speed control (0.5x-1.5x) and pause variants
- **Flowline Visualization**: Abstract animated mascot for synchronized playback
- **Practice Mode**: Interactive speaking practice with hints (no judgment)
- **Sample Content**: Pre-generated dialogues and audio courses to get started quickly

### Progressive Web App (PWA)

- **Install on Mobile**: Add to home screen on iOS and Android for app-like experience
- **Offline Support**: Access previously loaded content without internet
- **Mobile Optimized**: 44px touch targets for comfortable mobile use
- **Standalone Mode**: Launches without browser chrome when installed

### Generation Limits

- Learning OS enforces the shared monthly generation limit and cooldown
- ConvoLab reports the canonical quota returned by the Learning OS API
- Admin users have unlimited access

## Tech Stack

### Frontend

- React 18 + TypeScript
- Vite + VitePWA
- TailwindCSS
- Framer Motion
- WaveSurfer.js
- Workbox (service worker & offline caching)

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

## Mobile Usage (PWA)

ConvoLab works as a Progressive Web App, providing a native app-like experience on mobile devices:

### iOS (Safari)

1. Open ConvoLab in Safari
2. Tap the Share button (square with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" to confirm
5. The app icon will appear on your home screen
6. Launch it for a full-screen experience without browser chrome

### Android (Chrome)

1. Open ConvoLab in Chrome
2. Look for the install prompt (or tap the menu ⋮ > "Install app")
3. Tap "Install" to add to home screen
4. Launch from home screen for standalone mode

### Offline Support

- Previously loaded dialogues, courses, and audio remain accessible offline
- Service worker caches fonts, UI assets, and recently accessed content
- Audio files are cached for 30 days for offline playback

## Development

- **Client**: http://localhost:5173
- **Server**: http://localhost:3001

## Language Support

Currently supports Japanese only.

## License

MIT
