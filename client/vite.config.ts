import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared/src'),
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
