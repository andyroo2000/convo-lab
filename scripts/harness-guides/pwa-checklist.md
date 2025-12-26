# PWA Implementation Checklist

Complete checklist for implementing Progressive Web App features in ConvoLab.

## Web App Manifest

Location: `client/public/manifest.json`

### Required Fields

```json
{
  "name": "ConvoLab - Language Learning",
  "short_name": "ConvoLab",
  "description": "AI-powered language learning through conversations",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#4F46E5",
  "background_color": "#FFFFFF",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

### Optional but Recommended

```json
{
  "orientation": "portrait-primary",
  "scope": "/",
  "lang": "en",
  "categories": ["education", "productivity"],
  "screenshots": [
    {
      "src": "/screenshots/home.png",
      "sizes": "1280x720",
      "type": "image/png"
    }
  ],
  "shortcuts": [
    {
      "name": "New Dialogue",
      "short_name": "New",
      "url": "/create",
      "icons": [{ "src": "/icons/add.png", "sizes": "96x96" }]
    }
  ]
}
```

## HTML Meta Tags

Add to `client/index.html`:

```html
<!-- PWA Meta Tags -->
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#4F46E5" />

<!-- iOS Support -->
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="ConvoLab" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />

<!-- Windows Support -->
<meta name="msapplication-TileColor" content="#4F46E5" />
<meta name="msapplication-TileImage" content="/icons/mstile-144x144.png" />
```

## Icon Sizes Required

Generate icons at these sizes:

- 16x16 (favicon)
- 32x32 (favicon)
- 48x48 (browser tab)
- 72x72 (Android)
- 96x96 (Android)
- 120x120 (iOS)
- 128x128 (Chrome Web Store)
- 144x144 (Windows tile)
- 152x152 (iOS)
- 180x180 (iOS)
- 192x192 (Android, Chrome)
- 384x384 (Android)
- 512x512 (Android, splash screen)

## Service Worker

### Basic Service Worker Template

```typescript
// client/public/sw.js
const CACHE_NAME = 'convolab-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  // Add other static assets
];

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    })
  );
  self.clients.claim();
});

// Fetch - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip API requests
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request);
      })
  );
});
```

### Register Service Worker

```typescript
// client/src/registerSW.ts
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('SW registered:', registration.scope);
      } catch (error) {
        console.error('SW registration failed:', error);
      }
    });
  }
}
```

## Offline Support

### Offline Fallback Page

```html
<!-- client/public/offline.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Offline - ConvoLab</title>
    <style>
      body {
        font-family: system-ui;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        margin: 0;
        background: #f9fafb;
      }
      .container {
        text-align: center;
        padding: 2rem;
      }
      h1 {
        color: #111827;
      }
      p {
        color: #6b7280;
      }
      button {
        background: #4f46e5;
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 0.5rem;
        cursor: pointer;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>You're offline</h1>
      <p>Please check your internet connection.</p>
      <button onclick="location.reload()">Try Again</button>
    </div>
  </body>
</html>
```

## Install Prompt

```typescript
// client/src/hooks/usePWAInstall.ts
import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  return { isInstallable, install };
}
```

## PWA Audit Checklist

Run Lighthouse PWA audit and ensure:

- [ ] Has a valid web app manifest
- [ ] Registers a service worker
- [ ] Responds with 200 when offline
- [ ] Contains content when JavaScript is disabled
- [ ] Uses HTTPS
- [ ] Redirects HTTP to HTTPS
- [ ] All app URLs load while offline
- [ ] Page has viewport meta tag
- [ ] Content is sized correctly for viewport
- [ ] Has theme-color meta tag
- [ ] Has apple-touch-icon
- [ ] Manifest has maskable icon
- [ ] Page transitions feel smooth
