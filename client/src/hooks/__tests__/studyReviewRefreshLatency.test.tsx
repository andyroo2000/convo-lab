import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requestJson } from '../../lib/apiClient';
import { decodeStudyCardSummary } from '../../lib/learningOsContractDecoders';
import { studyCardCompatibilityFixture } from '../../test/fixtures/learningOsCompatibility';
import {
  createStudyReviewRequest,
  useRegenerateStudyAnswerAudio,
  useSubmitStudyReview,
  useUpdateStudyCard,
} from '../useStudy';

vi.mock('../../lib/apiClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/apiClient')>()),
  requestJson: vi.fn(),
}));

const card = decodeStudyCardSummary(studyCardCompatibilityFixture.cases[0].payload);
const overview = {
  dueCount: 1,
  newCount: 0,
  learningCount: 0,
  reviewCount: 1,
  suspendedCount: 0,
  totalCards: 2,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function renderReviewMutations() {
  const refresh = deferred<typeof overview>();
  const refreshOverview = vi.fn(() => refresh.promise);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const view = renderHook(
    () => {
      useQuery({
        queryKey: ['study', 'overview'],
        queryFn: refreshOverview,
        initialData: overview,
        staleTime: Infinity,
      });
      return {
        regenerate: useRegenerateStudyAnswerAudio(),
        save: useUpdateStudyCard(),
        review: useSubmitStudyReview(),
      };
    },
    { wrapper }
  );
  return { ...view, queryClient, refresh, refreshOverview };
}

describe('review completion during background refresh', () => {
  beforeEach(() => {
    vi.mocked(requestJson).mockReset();
  });

  it.each(['success', 'failure'] as const)(
    'releases the rating mutation after audio edits while an overview refresh awaits %s',
    async (outcome) => {
      const { result, queryClient, refresh, refreshOverview } = renderReviewMutations();
      const request = createStudyReviewRequest({ cardId: card.id, grade: 'good' });
      const updatedCard = { ...card, revision: 2 };
      const reviewResult = { card: updatedCard, overview, reviewLogId: request.clientReviewId };
      vi.mocked(requestJson)
        .mockResolvedValueOnce(updatedCard)
        .mockResolvedValueOnce(updatedCard)
        .mockResolvedValueOnce(reviewResult);

      await act(async () => {
        await result.current.regenerate.mutateAsync({ cardId: card.id });
        await result.current.save.mutateAsync({
          cardId: card.id,
          expectedRevision: updatedCard.revision,
          prompt: updatedCard.prompt,
          answer: updatedCard.answer,
        });
      });

      let committedResult: unknown;
      act(() => {
        result.current.review.mutateAsync(request).then((value) => {
          committedResult = value;
        });
      });
      await waitFor(() => expect(refreshOverview).toHaveBeenCalledOnce());
      await waitFor(() => expect(result.current.review.isPending).toBe(false));
      expect(committedResult).toEqual(reviewResult);
      expect(queryClient.getQueryState(['study', 'overview'])?.fetchStatus).toBe('fetching');

      await act(async () => {
        if (outcome === 'success') refresh.resolve(overview);
        else refresh.reject(new Error('Dashboard unavailable'));
        await refresh.promise.catch(() => undefined);
      });
      expect(result.current.review.isSuccess).toBe(true);
      expect(requestJson).toHaveBeenCalledTimes(3);
      queryClient.clear();
    }
  );

  it('keeps the rating pending until the server confirms the review', async () => {
    const { result, queryClient, refreshOverview } = renderReviewMutations();
    const response = deferred<unknown>();
    vi.mocked(requestJson).mockReturnValue(response.promise);
    const request = createStudyReviewRequest({ cardId: card.id, grade: 'good' });
    let submission!: ReturnType<typeof result.current.review.mutateAsync>;
    act(() => {
      submission = result.current.review.mutateAsync(request);
    });
    await waitFor(() => expect(result.current.review.isPending).toBe(true));
    expect(refreshOverview).not.toHaveBeenCalled();

    await act(async () => {
      response.reject(new Error('Review was not saved'));
      await expect(submission).rejects.toThrow('Review was not saved');
    });
    await waitFor(() => expect(result.current.review.isError).toBe(true));
    expect(refreshOverview).not.toHaveBeenCalled();
    queryClient.clear();
  });
});
