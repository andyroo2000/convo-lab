import { act, renderHook } from '@testing-library/react';
import type { StudyCardSummary, StudyOverview } from '@languageflow/shared/src/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  startStudyIntroductionCohortLesson,
  startStudyLesson,
  startStudySession,
  type StudySessionResponse,
} from '../useStudy';
import useStudySessionLoader from '../useStudySessionLoader';

vi.mock('../useStudy', () => ({
  startStudyIntroductionCohortLesson: vi.fn(),
  startStudyLesson: vi.fn(),
  startStudySession: vi.fn(),
}));

const startStudyIntroductionCohortLessonMock = vi.mocked(startStudyIntroductionCohortLesson);
const startStudyLessonMock = vi.mocked(startStudyLesson);
const startStudySessionMock = vi.mocked(startStudySession);

const overview = { dueCount: 0, failedCount: 0 } as StudyOverview;
const card = { id: 'card-1' } as StudyCardSummary;

const makeSession = (cards: StudyCardSummary[] = [card]): StudySessionResponse => ({
  cards,
  overview,
});

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const setupLoader = () => {
  const autoRefreshEmptySessionRef = { current: false };
  const sessionEpochRef = { current: 0 };
  const setLessonPhase = vi.fn();
  const setSession = vi.fn();
  const setSessionError = vi.fn();
  const setSessionLoading = vi.fn();
  const syncOverview = vi.fn();

  const view = renderHook(() =>
    useStudySessionLoader({
      autoRefreshEmptySessionRef,
      sessionEpochRef,
      sessionKind: 'reviews',
      setLessonPhase,
      setSession,
      setSessionError,
      setSessionLoading,
      syncOverview,
    })
  );

  return {
    ...view,
    autoRefreshEmptySessionRef,
    sessionEpochRef,
    setLessonPhase,
    setSession,
    setSessionError,
    setSessionLoading,
    syncOverview,
  };
};

describe('useStudySessionLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('commits a current review session and enables one empty-session refresh', async () => {
    const session = makeSession([]);
    startStudySessionMock.mockResolvedValue(session);
    const loader = setupLoader();

    await act(async () => {
      await loader.result.current.loadSession();
    });

    expect(loader.setSessionLoading.mock.calls).toEqual([[true], [false]]);
    expect(loader.setSessionError).toHaveBeenCalledWith(null);
    expect(loader.setSession).toHaveBeenCalledWith(session);
    expect(loader.setLessonPhase).toHaveBeenCalledWith('quiz');
    expect(loader.syncOverview).toHaveBeenCalledWith(overview);
    expect(loader.autoRefreshEmptySessionRef.current).toBe(true);
    expect(loader.result.current.sessionCardCountRef.current).toBe(0);
  });

  it('loads a requested introduction cohort as a lesson session', async () => {
    const session = makeSession();
    startStudyIntroductionCohortLessonMock.mockResolvedValue(session);
    const loader = setupLoader();

    await act(async () => {
      await loader.result.current.loadSession('lessons', { lessonCohortId: 'cohort-1' });
    });

    expect(startStudyIntroductionCohortLessonMock).toHaveBeenCalledWith('cohort-1');
    expect(startStudyLessonMock).not.toHaveBeenCalled();
    expect(loader.setLessonPhase).toHaveBeenCalledWith('preview');
    expect(loader.autoRefreshEmptySessionRef.current).toBe(false);
  });

  it('ignores a response after the session epoch changes', async () => {
    const deferred = createDeferred<StudySessionResponse>();
    startStudySessionMock.mockReturnValue(deferred.promise);
    const loader = setupLoader();
    const loadPromise = loader.result.current.loadSession();

    loader.sessionEpochRef.current += 1;
    deferred.resolve(makeSession());

    await expect(loadPromise).resolves.toBeNull();
    expect(loader.setSession).not.toHaveBeenCalled();
    expect(loader.syncOverview).not.toHaveBeenCalled();
  });

  it('allows only the newest overlapping request to commit', async () => {
    const firstRequest = createDeferred<StudySessionResponse>();
    const newestSession = makeSession([{ ...card, id: 'newest-card' }]);
    startStudySessionMock
      .mockReturnValueOnce(firstRequest.promise)
      .mockResolvedValueOnce(newestSession);
    const loader = setupLoader();

    const stalePromise = loader.result.current.loadSession();
    await act(async () => {
      await loader.result.current.loadSession();
    });
    firstRequest.resolve(makeSession([{ ...card, id: 'stale-card' }]));

    await expect(stalePromise).resolves.toBeNull();
    expect(loader.setSession).toHaveBeenCalledTimes(1);
    expect(loader.setSession).toHaveBeenCalledWith(newestSession);
  });

  it('surfaces a current request error and clears loading', async () => {
    const error = new Error('Session unavailable');
    startStudySessionMock.mockRejectedValue(error);
    const loader = setupLoader();

    await expect(loader.result.current.loadSession()).rejects.toBe(error);
    expect(loader.setSession).toHaveBeenCalledWith(null);
    expect(loader.setSessionError).toHaveBeenLastCalledWith('Session unavailable');
    expect(loader.setSessionLoading.mock.calls).toEqual([[true], [false]]);
  });
});
