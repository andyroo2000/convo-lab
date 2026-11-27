import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import LearnLessonConversation from '../LearnLessonConversation';
import learnStepKey from '../learnStepKey';
import type { LearnLesson, LearnSession } from '../types';

const lesson: LearnLesson = {
  id: 'rashii',
  title: 'らしい',
  subtitle: '',
  source: '',
  reference: '',
  checkCount: 9,
  exerciseCount: 6,
};
const session: LearnSession = {
  id: 'saved',
  lessonId: 'rashii',
  version: 3,
  busy: false,
  updatedAt: '',
  prompt: null,
  state: { phase: 'complete', index: 0, answered: false, turns: [] },
};

describe('Reviewing completed explanations', () => {
  beforeAll(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('offers review inside the tutor card without using the next action', () => {
    const onReview = vi.fn();
    const onNext = vi.fn();
    render(
      <MemoryRouter>
        <LearnLessonConversation
          session={session}
          lesson={lesson}
          busy={false}
          onNext={onNext}
          onReview={onReview}
        />
      </MemoryRouter>
    );
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Your tutor' })).getByRole('button', {
        name: 'Review explanations',
      })
    );
    expect(onReview).toHaveBeenCalledOnce();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('keeps earlier introduction replies out of the current review step', () => {
    const reviewing: LearnSession = {
      ...session,
      prompt: { id: 'meaning', prompt: 'Does that make sense so far?' },
      state: {
        phase: 'check',
        index: 0,
        answered: false,
        reviewing: true,
        reviewRun: 2,
        turns: [
          {
            id: 'old',
            stepKey: 'check:0',
            kind: 'clarify',
            text: 'Why?',
            message: 'An earlier explanation',
            segments: [],
          },
        ],
      },
    };
    render(
      <LearnLessonConversation session={reviewing} lesson={lesson} busy={false} onNext={vi.fn()} />
    );
    const current = screen.getAllByRole('region', { name: 'Your tutor' })[0];
    expect(within(current).getByRole('button', { name: 'I understand' })).toBeVisible();
    expect(learnStepKey(reviewing.state)).toBe('review:2:0');
    expect(learnStepKey({ ...reviewing.state, reviewRun: 1 })).toBe('review:1:0');
    expect(learnStepKey(session.state)).toBe('complete:0');
  });
});
