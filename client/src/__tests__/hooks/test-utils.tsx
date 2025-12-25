import React, { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a test wrapper with React Query
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function createWrapper(queryClient?: QueryClient) {
  const client = queryClient ?? createTestQueryClient();

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return Wrapper;
}

// Helper to wait for queries to settle
export async function waitForQuery(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
