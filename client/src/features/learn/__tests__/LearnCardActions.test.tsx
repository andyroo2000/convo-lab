import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { LearnQuestion } from '../LearnLessonContent';
import LearnTranscript from '../LearnTranscript';
import LearnLessonConversation from '../LearnLessonConversation';
import type { LearnLesson, LearnSession, LearnTurn } from '../types';

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
  prompt: { id: 'meaning', prompt: 'Does that make sense so far?' },
};
const turn: LearnTurn = {
  id: 'first',
  stepKey: 'exercise:0',
  kind: 'answer',
  text: 'An answer',
  message: 'First feedback',
  segments: [],
};

describe('Tutor card actions', () => {
  beforeAll(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  it('keeps the introduction action inside the tutor card', () => {
    const onNext = vi.fn();
    render(
      <LearnQuestion
        session={session}
        lesson={lesson}
        action={
          <button type="button" onClick={onNext}>
            I understand
          </button>
        }
      />
    );
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Your tutor' })).getByRole('button', {
        name: 'I understand',
      })
    );
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('puts one action in the latest feedback card, not in earlier replies', () => {
    render(
      <LearnTranscript
        turns={[
          turn,
          { ...turn, id: 'second', kind: 'clarify', text: 'Why?', message: 'The explanation' },
        ]}
        stepKey="exercise:0"
        action={<button type="button">I understand</button>}
      />
    );
    const cards = screen.getAllByRole('region', { name: 'Your tutor' });
    expect(within(cards[0]).queryByRole('button')).not.toBeInTheDocument();
    expect(within(cards[1]).getByRole('button', { name: 'I understand' })).toBeVisible();
    expect(screen.getAllByRole('button', { name: 'I understand' })).toHaveLength(1);
  });
  it('moves the action from the introduction to the latest clarification without duplicates', () => {
    const props = { session, lesson, busy: false, onNext: vi.fn() };
    const { rerender } = render(<LearnLessonConversation {...props} />);
    expect(screen.getAllByRole('button', { name: 'I understand' })).toHaveLength(1);
    const reply: LearnTurn = {
      ...turn,
      stepKey: 'check:0',
      kind: 'clarify',
      message: 'More explanation',
    };
    rerender(
      <LearnLessonConversation
        {...props}
        session={{ ...session, state: { ...session.state, turns: [reply] } }}
      />
    );
    const cards = screen.getAllByRole('region', { name: 'Your tutor' });
    expect(within(cards[0]).queryByRole('button')).not.toBeInTheDocument();
    expect(within(cards[1]).getByRole('button', { name: 'I understand' })).toBeVisible();
    expect(screen.getAllByRole('button', { name: 'I understand' })).toHaveLength(1);
  });
});
