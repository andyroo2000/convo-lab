import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './styles/index.css';

// Global error handler for chunk loading failures
// This catches errors that might not be caught by ErrorBoundary
window.addEventListener('error', (event) => {
  const chunkFailedMessage =
    /Failed to fetch dynamically imported module|Loading chunk.*failed|ChunkLoadError/i;
  if (
    chunkFailedMessage.test(event.message) ||
    (event.error && chunkFailedMessage.test(event.error.message))
  ) {
    console.warn('Chunk loading error detected - likely due to new deployment. Prompting reload.');
    event.preventDefault();

    // Show a simple alert and reload
    // eslint-disable-next-line no-alert
    if (
      window.confirm(
        'A new version of ConvoLab is available. Reload now to get the latest updates?'
      )
    ) {
      window.location.reload();
    }
  }
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error: unknown) => {
        // Don't retry on 4xx errors (client errors)
        if (
          typeof error === 'object' &&
          error !== null &&
          'response' in error &&
          typeof error.response === 'object' &&
          error.response !== null &&
          'status' in error.response &&
          typeof error.response.status === 'number' &&
          error.response.status >= 400 &&
          error.response.status < 500
        ) {
          return false;
        }
        // Retry up to 2 times for network/server errors
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
