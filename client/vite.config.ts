import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

import pwaManifest from './src/config/pwaManifest';

const learningOsLegacyGenerationProxy = (namespace: 'dialogue' | 'audio' | 'images') => ({
  target: 'http://localhost:8080',
  changeOrigin: true,
  rewrite: (requestPath: string) =>
    requestPath.replace(new RegExp(`^/api/${namespace}(?=/|$)`), `/api/convolab/${namespace}`),
});

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      disable: process.env.VITE_DISABLE_PWA === 'true',
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        minify: false,
        sourcemap: false,
      },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: pwaManifest,
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared/src'),
      '@languageflow/shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/sanctum/csrf-cookie': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/convolab/auth': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/convolab/browser/auth': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/convolab/episodes': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/convolab/courses': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/convolab/scripts': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/convolab/dialogue': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/convolab/audio': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/convolab/images': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '^/api/dialogue(?:/|$)': learningOsLegacyGenerationProxy('dialogue'),
      '^/api/audio(?:/|$)': learningOsLegacyGenerationProxy('audio'),
      '^/api/images(?:/|$)': learningOsLegacyGenerationProxy('images'),
      '/api/convolab/admin': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/convolab/browser/tools/analytics': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/feature-flags': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '^/api/study(?:/|$)': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '^/api/daily-audio-practice(?:/|$)': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/auth/password': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/avatars': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/tools-audio': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/avatars': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/audio': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React - rarely changes, cache long-term
          'vendor-react': ['react', 'react-dom'],
          // Routing - separate chunk for navigation
          'vendor-router': ['react-router-dom'],
          // Data fetching - React Query
          'vendor-query': ['@tanstack/react-query'],
          // Animation library - large, used selectively
          'vendor-framer': ['framer-motion'],
          // Audio - WaveSurfer is large
          'vendor-audio': ['wavesurfer.js'],
          // Utilities
          'vendor-utils': ['date-fns', 'clsx'],
        },
      },
    },
  },
});
