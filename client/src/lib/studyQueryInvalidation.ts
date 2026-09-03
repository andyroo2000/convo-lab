import {
  useMutation,
  useQueryClient,
  type MutationFunction,
  type QueryClient,
} from '@tanstack/react-query';

export type StudyQueryScope =
  | 'browser'
  | 'cards'
  | 'export'
  | 'learning-items'
  | 'learning-path'
  | 'manual-card-drafts'
  | 'new-queue'
  | 'overview'
  | 'session'
  | 'settings';

export function invalidateStudyQueries(
  queryClient: QueryClient,
  scopes: readonly StudyQueryScope[]
) {
  return Promise.all(
    scopes.map((scope) => queryClient.invalidateQueries({ queryKey: ['study', scope] }))
  );
}

export default function useStudyMutationWithInvalidations<TData, TVariables>(
  mutationFn: MutationFunction<TData, TVariables>,
  scopes: readonly StudyQueryScope[]
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await invalidateStudyQueries(queryClient, scopes);
    },
  });
}
