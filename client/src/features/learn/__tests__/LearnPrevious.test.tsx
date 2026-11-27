import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LearnLessonWorkspace from '../LearnLessonWorkspace';
import LearnStageNavigation from '../LearnStageNavigation';
import { LearnQuestion } from '../LearnLessonContent';
import { LearnNext } from '../LearnSessionControls';
import { openLearnLesson, sendLearnTurn } from '../learnApi';
import type { LearnLesson, LearnSession } from '../types';

vi.mock('../useLearnTutor', () => ({ default: () => undefined }));
vi.mock('../learnApi', () => ({
  getLearnSession: vi.fn(),
  openLearnLesson: vi.fn(),
  sendLearnTurn: vi.fn(),
}));
const lesson: LearnLesson = {
  id: 'nara',
  title: 'なら',
  subtitle: '',
  source: '',
  reference: '',
  checkCount: 9,
  exerciseCount: 7,
};
const session: LearnSession = {
  id: 's',
  lessonId: 'nara',
  version: 1,
  busy: false,
  updatedAt: '',
  state: { phase: 'check', index: 1, answered: false, turns: [] },
  prompt: { id: 'second', prompt: 'Does that make sense so far?' },
};

describe('Previous explanation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('only offers previous within Understand after its first step', () => {
    const props = { session, lesson, busy: false, onNext: vi.fn(), onPrevious: vi.fn() };
    const { rerender } = render(<LearnNext {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous explanation' }));
    expect(props.onPrevious).toHaveBeenCalledOnce();
    expect(props.onNext).not.toHaveBeenCalled();
    rerender(<LearnNext {...props} busy />);
    expect(screen.getByRole('button', { name: 'Previous explanation' })).toBeDisabled();
    rerender(
      <LearnNext {...props} session={{ ...session, state: { ...session.state, index: 0 } }} />
    );
    expect(screen.queryByRole('button', { name: 'Previous explanation' })).not.toBeInTheDocument();
    rerender(
      <LearnNext
        {...props}
        session={{ ...session, state: { ...session.state, phase: 'exercise', answered: true } }}
      />
    );
    expect(screen.queryByRole('button', { name: 'Previous explanation' })).not.toBeInTheDocument();
  });

  it('keeps each draft and uses the previous action without submitting its text', async () => {
    vi.mocked(openLearnLesson).mockResolvedValue(session);
    vi.mocked(sendLearnTurn)
      .mockResolvedValueOnce({
        ...session,
        version: 2,
        state: { ...session.state, index: 0 },
        prompt: { id: 'first', prompt: 'Does that make sense so far?' },
      })
      .mockResolvedValueOnce({ ...session, version: 3 });
    const cache = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    render(
      <MemoryRouter>
        <QueryClientProvider client={cache}>
          <LearnLessonWorkspace ownerId="owner" lesson={lesson} />
        </QueryClientProvider>
      </MemoryRouter>
    );
    fireEvent.change(await screen.findByRole('textbox', { name: 'Your reply' }), {
      target: { value: 'A question about this example' },
    });
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Your tutor' })).getByRole('button', {
        name: 'Previous explanation',
      })
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Previous explanation' })).not.toBeInTheDocument()
    );
    expect(screen.getByRole('textbox', { name: 'Your reply' })).toHaveValue('');
    fireEvent.change(screen.getByRole('textbox', { name: 'Your reply' }), {
      target: { value: 'A question about the first example' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'I understand' }));
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Your reply' })).toHaveValue(
        'A question about this example'
      )
    );
    expect(sendLearnTurn).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ version: 1 }),
      'previous',
      undefined
    );
    expect(JSON.parse(sessionStorage.getItem('learn-draft:owner:s:check:0')!)).toEqual({
      text: 'A question about the first example',
    });
  });

  it('explains why textbook-only points have no workbook stage', () => {
    const finished: LearnSession = {
      ...session,
      state: { ...session.state, phase: 'complete', completed: true },
    };
    render(
      <>
        <LearnStageNavigation
          session={finished}
          busy={false}
          hasWorkbook={false}
          onNavigate={vi.fn()}
        />
        <LearnQuestion session={finished} lesson={{ ...lesson, exerciseCount: 0 }} />
      </>
    );
    expect(screen.getByRole('button', { name: 'Ready?' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Workbook' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reflect' })).toBeEnabled();
    expect(screen.getByText(/The workbook has no separate exercise set/)).toBeVisible();
  });
});
