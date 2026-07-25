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

Practice Mode walks through an episode line by line, plays either sentence audio or the
matching slice of the full episode, reveals translations on demand, and lets learners
record and replay their own response locally. Recordings are not uploaded or scored.

Content generation is available to invited users without monthly or credit entitlements.
Short-window API rate limits remain in place to protect service stability.

## Tech Stack

### Frontend

- React 18 + TypeScript
- Vite + VitePWA
- TailwindCSS
- Framer Motion
- WaveSurfer.js
- Workbox (service worker & offline caching)

### Backend

- Learning OS Laravel API
- PostgreSQL
- Google Cloud Storage
- OpenAI and Fish Audio generation services

### Hosting

- Static Nginx frontend
- Learning OS API and worker
- PostgreSQL on DigitalOcean

## Project Structure

```
convo-lab/
├── client/          # React frontend
├── shared/          # Shared types and utilities
├── deploy/          # Static frontend routing and smoke checks
└── docs/            # Documentation
```

## Getting Started

### Prerequisites

- Node.js 20+
- A running Learning OS API

### Environment Setup

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Set `LEARNING_OS_API_URL` when Learning OS is not available at the default
   local API URL.

4. Start the development server:
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
- **Learning OS API**: http://localhost:8080

## Language Support

Currently supports Japanese only.

## License

MIT
