import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getLearnSession, openLearnLesson, sendLearnTurn } from './learnApi';
import type { LearnAction, LearnSession } from './types';

export default function useLearnSession(ownerId: string, lessonId: string) {
  const cache = useQueryClient();
  const key = ['learn-session', ownerId, lessonId];
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => {
      const saved = cache.getQueryData<LearnSession>(key);
      return saved ? getLearnSession(saved.id, signal) : openLearnLesson(lessonId, signal);
    },
    retry: false,
    refetchInterval: (value) => (value.state.data?.busy ? 2000 : false),
  });
  const mutation = useMutation({
    mutationFn: ({ action, text }: { action: LearnAction; text?: string }) => {
      if (!query.data) throw new Error('The lesson is still loading.');
      return sendLearnTurn(query.data, action, text);
    },
    onMutate: async ({ action }) => {
      await cache.cancelQueries({ queryKey: key });
      const previous = cache.getQueryData<LearnSession>(key);
      if (action === 'next' && previous?.nextStep) {
        const next = previous.nextStep;
        cache.setQueryData<LearnSession>(key, {
          ...previous,
          state: {
            ...previous.state,
            phase: next.phase,
            index: next.index,
            answered: next.answered ?? false,
            reviewing: next.reviewing ?? previous.state.reviewing,
            completed: next.completed ?? previous.state.completed,
          },
          prompt: next.prompt,
          nextStep: null,
        });
      }
      return { previous };
    },
    onSuccess: (session) => {
      cache.setQueryData(key, session);
      cache.invalidateQueries({ queryKey: ['learn-collection', ownerId] });
    },
    onError: (_error, _input, context) => {
      if (context?.previous) cache.setQueryData(key, context.previous);
      query.refetch();
    },
  });
  return {
    ...query,
    send: mutation.mutateAsync,
    busy: mutation.isPending || Boolean(query.data?.busy),
    savingProgress:
      mutation.isPending &&
      ['next', 'previous', 'review', 'understand', 'ready', 'workbook', 'reflect'].includes(
        mutation.variables.action
      ),
    sendError: mutation.error,
  };
}
