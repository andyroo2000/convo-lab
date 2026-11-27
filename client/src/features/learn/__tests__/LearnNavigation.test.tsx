import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LearnStageNavigation from '../LearnStageNavigation';
import LearnLessonWorkspace from '../LearnLessonWorkspace';
import { openLearnLesson, sendLearnTurn } from '../learnApi';
import type { LearnLesson, LearnSession } from '../types';

vi.mock('../useLearnTutor', () => ({ default: () => undefined }));
vi.mock('../learnApi', () => ({
  getLearnSession: vi.fn(),
  openLearnLesson: vi.fn(),
  sendLearnTurn: vi.fn(),
}));
const lesson: LearnLesson = {
  id: 'toori',
  title: 'とおり',
  subtitle: '',
  source: '',
  reference: '',
  checkCount: 5,
  exerciseCount: 6,
};
const session: LearnSession = {
  id: 'session',
  lessonId: 'toori',
  version: 1,
  busy: false,
  updatedAt: '',
  state: { phase: 'check', index: 1, answered: false, turns: [] },
  prompt: { id: 'matching', prompt: 'Does that make sense so far?' },
  nextStep: null,
};

describe('Lesson stage navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('keeps Reflect locked until completion and disables stage changes while saving', () => {
    const onNavigate = vi.fn();
    const { rerender } = render(
      <LearnStageNavigation session={session} busy={false} onNavigate={onNavigate} />
    );
    expect(screen.getByRole('button', { name: 'Understand' })).toHaveAttribute(
      'aria-current',
      'step'
    );
    expect(screen.getByRole('button', { name: 'Reflect' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Workbook' }));
    expect(onNavigate).toHaveBeenCalledWith('workbook');
    rerender(
      <LearnStageNavigation
        session={{ ...session, state: { ...session.state, completed: true } }}
        busy={false}
        onNavigate={onNavigate}
      />
    );
    expect(screen.getByRole('button', { name: 'Reflect' })).toBeEnabled();
    rerender(<LearnStageNavigation session={session} busy onNavigate={onNavigate} />);
    screen.getAllByRole('button').forEach((button) => expect(button).toBeDisabled());
  });

  it('preserves separate explanation and workbook drafts when switching stages', async () => {
    vi.mocked(openLearnLesson).mockResolvedValue(session);
    const workbook: LearnSession = {
      ...session,
      version: 2,
      state: { ...session.state, phase: 'exercise', index: 2 },
      prompt: { id: 'teacher', prompt: 'Complete the sentence.' },
    };
    vi.mocked(sendLearnTurn)
      .mockResolvedValueOnce(workbook)
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
    const reply = await screen.findByRole('textbox', { name: 'Your reply' });
    fireEvent.change(reply, { target: { value: 'Why is there no に here?' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Workbook' })[0]);
    expect(await screen.findByText('Workbook question 3 of 6')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Your reply' })).toHaveValue('');
    fireEvent.change(screen.getByRole('textbox', { name: 'Your reply' }), {
      target: { value: 'My unfinished answer' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Understand' })[0]);
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Your reply' })).toHaveValue(
        'Why is there no に here?'
      )
    );
    expect(JSON.parse(sessionStorage.getItem('learn-draft:owner:session:exercise:2')!)).toEqual({
      text: 'My unfinished answer',
    });
    expect(sendLearnTurn).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ version: 1 }),
      'workbook',
      undefined
    );
    expect(sendLearnTurn).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ version: 2 }),
      'understand',
      undefined
    );
  });
});
