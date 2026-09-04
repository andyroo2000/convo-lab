import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { isChunkLoadingError, shouldRetryQuery } from './lib/applicationPolicies';
import { installCsrfFetch } from './lib/csrf';
import registerConvoLabServiceWorker from './lib/registerServiceWorker';
import './styles/index.css';

registerConvoLabServiceWorker();

// Global error handler for chunk loading failures
// This catches errors that might not be caught by ErrorBoundary
window.addEventListener('error', (event) => {
  if (isChunkLoadingError(event)) {
    console.warn('Chunk loading error detected - likely due to new deployment. Prompting reload.');
    event.preventDefault();

    // Show a simple alert and reload
    if (
      // eslint-disable-next-line no-alert
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
      // Don't retry on 4xx errors; retry network/server errors up to 2 times.
      retry: shouldRetryQuery,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Install the global fetch wrapper before mounting the app so first-party modules do not
// capture an unwrapped fetch reference before CSRF headers are injected on mutations.
installCsrfFetch();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
