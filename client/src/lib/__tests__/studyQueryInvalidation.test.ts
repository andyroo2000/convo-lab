import type { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { invalidateStudyQueries } from '../studyQueryInvalidation';

describe('study query invalidation', () => {
  it('invalidates every requested study query scope', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const queryClient = { invalidateQueries } as unknown as QueryClient;

    await invalidateStudyQueries(queryClient, ['new-queue', 'overview', 'cards']);

    expect(invalidateQueries.mock.calls).toEqual([
      [{ queryKey: ['study', 'new-queue'] }],
      [{ queryKey: ['study', 'overview'] }],
      [{ queryKey: ['study', 'cards'] }],
    ]);
  });
});
