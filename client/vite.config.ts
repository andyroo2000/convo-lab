import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

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
      manifest: {
        name: 'ConvoLab',
        short_name: 'ConvoLab',
        description: 'A creative language learning and dialogue generation tool',
        theme_color: '#5E6AD8',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
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
