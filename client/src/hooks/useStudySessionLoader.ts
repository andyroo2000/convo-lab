import {
  useCallback,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { StudyOverview } from '@languageflow/shared/src/types';

import {
  startStudyIntroductionCohortLesson,
  startStudyLesson,
  startStudySession,
  type StudySessionResponse,
} from './useStudy';

export type StudySessionKind = 'reviews' | 'lessons';

export interface StudySessionLoadOptions {
  allowEmptySessionRefresh?: boolean;
  lessonCohortId?: string;
}

const fetchStudySession = (kind: StudySessionKind, lessonCohortId?: string) => {
  if (kind === 'reviews') return startStudySession();
  if (lessonCohortId) return startStudyIntroductionCohortLesson(lessonCohortId);
  return startStudyLesson();
};

const shouldRefreshEmptySession = (
  kind: StudySessionKind,
  session: StudySessionResponse,
  options: StudySessionLoadOptions
) => kind === 'reviews' && session.cards.length === 0 && options.allowEmptySessionRefresh !== false;

interface UseStudySessionLoaderOptions {
  autoRefreshEmptySessionRef: MutableRefObject<boolean>;
  sessionEpochRef: MutableRefObject<number>;
  sessionKind: StudySessionKind;
  setLessonPhase: Dispatch<SetStateAction<'preview' | 'quiz' | 'complete'>>;
  setSession: Dispatch<SetStateAction<StudySessionResponse | null>>;
  setSessionError: Dispatch<SetStateAction<string | null>>;
  setSessionLoading: Dispatch<SetStateAction<boolean>>;
  syncOverview: (overview: StudyOverview) => void;
}

type StudySessionLoadContext = Omit<UseStudySessionLoaderOptions, 'sessionKind'> & {
  expectedEpoch: number;
  kind: StudySessionKind;
  options: StudySessionLoadOptions;
  requestId: number;
  sessionCardCountRef: MutableRefObject<number>;
  sessionLoadRequestRef: MutableRefObject<number>;
};

const isCurrentSessionRequest = ({
  expectedEpoch,
  requestId,
  sessionEpochRef,
  sessionLoadRequestRef,
}: StudySessionLoadContext) =>
  sessionEpochRef.current === expectedEpoch && sessionLoadRequestRef.current === requestId;

const applyLoadedSession = (context: StudySessionLoadContext, session: StudySessionResponse) => {
  context.autoRefreshEmptySessionRef.current = shouldRefreshEmptySession(
    context.kind,
    session,
    context.options
  );
  context.sessionCardCountRef.current = session.cards.length;
  context.setSession(session);
  context.setLessonPhase(context.kind === 'lessons' ? 'preview' : 'quiz');
  context.syncOverview(session.overview);
};

const getSessionLoadErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Study session failed to load.';

const executeSessionLoad = async (context: StudySessionLoadContext) => {
  if (!isCurrentSessionRequest(context)) return null;

  context.setSessionLoading(true);
  context.setSessionError(null);

  try {
    const session = await fetchStudySession(context.kind, context.options.lessonCohortId);
    if (!isCurrentSessionRequest(context)) return null;

    applyLoadedSession(context, session);
    return session;
  } catch (error) {
    if (!isCurrentSessionRequest(context)) return null;

    context.setSession(null);
    context.setSessionError(getSessionLoadErrorMessage(error));
    throw error;
  } finally {
    if (isCurrentSessionRequest(context)) {
      context.setSessionLoading(false);
    }
  }
};

const useStudySessionLoader = ({
  autoRefreshEmptySessionRef,
  sessionEpochRef,
  sessionKind,
  setLessonPhase,
  setSession,
  setSessionError,
  setSessionLoading,
  syncOverview,
}: UseStudySessionLoaderOptions) => {
  const sessionCardCountRef = useRef(0);
  const sessionLoadRequestRef = useRef(0);

  const loadSession = useCallback(
    async (
      kind: StudySessionKind = sessionKind,
      options: StudySessionLoadOptions = {},
      expectedEpoch = sessionEpochRef.current
    ) => {
      const requestId = sessionLoadRequestRef.current + 1;
      sessionLoadRequestRef.current = requestId;
      return executeSessionLoad({
        autoRefreshEmptySessionRef,
        expectedEpoch,
        kind,
        options,
        requestId,
        sessionCardCountRef,
        sessionEpochRef,
        sessionLoadRequestRef,
        setLessonPhase,
        setSession,
        setSessionError,
        setSessionLoading,
        syncOverview,
      });
    },
    [
      autoRefreshEmptySessionRef,
      sessionEpochRef,
      sessionKind,
      setLessonPhase,
      setSession,
      setSessionError,
      setSessionLoading,
      syncOverview,
    ]
  );

  return { loadSession, sessionCardCountRef };
};

export default useStudySessionLoader;
