import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LearnNext, LearnSessionFeedback } from '../LearnSessionControls';
import useLearnSession from '../useLearnSession';
import { getLearnSession, sendLearnTurn } from '../learnApi';
import type { LearnLesson, LearnSession } from '../types';

vi.mock('../learnApi', () => ({
  getLearnSession: vi.fn(),
  openLearnLesson: vi.fn(),
  sendLearnTurn: vi.fn(),
}));
const lesson: LearnLesson = {
  id: 'rashii',
  title: 'らしい',
  subtitle: '',
  source: '',
  reference: '',
  checkCount: 4,
  exerciseCount: 6,
};
const session: LearnSession = {
  id: 's',
  lessonId: 'rashii',
  version: 1,
  busy: false,
  updatedAt: '',
  state: { phase: 'check', index: 0, answered: false, turns: [] },
  prompt: { id: 'first', prompt: 'Does that make sense so far?' },
  nextStep: {
    phase: 'check',
    index: 1,
    prompt: { id: 'second', prompt: 'Does that make sense so far?' },
  },
};
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  client.setQueryData(['learn-session', 'owner', 'rashii'], structuredClone(session));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useLearnSession('owner', 'rashii'), { wrapper });
}

describe('Immediate lesson advancement', () => {
  beforeEach(() => vi.resetAllMocks());

  it('shows I understand before any reply and keeps workbook progression gated', () => {
    const props = { session, lesson, busy: false, error: null, onReload: vi.fn(), onNext: vi.fn() };
    const { rerender } = render(<LearnNext {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'I understand' }));
    expect(props.onNext).toHaveBeenCalledOnce();
    rerender(
      <>
        <LearnNext {...props} busy />
        <LearnSessionFeedback {...props} busy savingProgress />
      </>
    );
    expect(screen.getByRole('button', { name: 'I understand' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Saving progress');
    rerender(
      <LearnNext
        {...props}
        session={{ ...session, state: { ...session.state, phase: 'exercise' } }}
      />
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows the preloaded next step immediately and confirms the server version after saving', async () => {
    let finish!: (value: LearnSession) => void;
    vi.mocked(sendLearnTurn).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const { result } = setup();
    let sent!: Promise<unknown>;
    act(() => {
      sent = result.current.send({ action: 'next' });
    });
    await waitFor(() => expect(result.current.data?.prompt?.id).toBe('second'));
    expect(result.current.savingProgress).toBe(true);
    expect(result.current.data?.version).toBe(1);
    expect(result.current.data?.nextStep).toBeNull();
    expect(sendLearnTurn).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's', version: 1 }),
      'next',
      undefined
    );
    await act(async () => {
      finish({
        ...session,
        state: { ...session.state, index: 1 },
        prompt: session.nextStep!.prompt,
        version: 2,
        nextStep: null,
      });
      await sent;
    });
    await waitFor(() => expect(result.current.savingProgress).toBe(false));
    expect(result.current.data?.version).toBe(2);
  });

  it('restores the original step after a failed save and refreshes server progress', async () => {
    let fail!: (reason: Error) => void;
    vi.mocked(sendLearnTurn).mockReturnValue(
      new Promise((_resolve, reject) => {
        fail = reject;
      })
    );
    vi.mocked(getLearnSession).mockResolvedValue(session);
    const { result } = setup();
    let sent!: Promise<unknown>;
    act(() => {
      sent = result.current.send({ action: 'next' }).catch((error) => error);
    });
    await waitFor(() => expect(result.current.data?.state.index).toBe(1));
    await act(async () => {
      fail(new Error('Save failed'));
      await sent;
    });
    await waitFor(() => expect(result.current.data?.state.index).toBe(0));
    expect(result.current.sendError?.message).toBe('Save failed');
    expect(getLearnSession).toHaveBeenCalled();
    expect(result.current.data?.prompt?.id).toBe('first');
  });
});
