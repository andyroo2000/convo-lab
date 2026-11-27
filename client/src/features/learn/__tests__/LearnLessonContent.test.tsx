import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LearnQuestion } from '../LearnLessonContent';
import { LearnExchange } from '../LearnTranscript';
import type { LearnLesson, LearnSession } from '../types';

const lesson: LearnLesson = {
  id: 'rashii',
  title: 'らしい',
  subtitle: 'Two uses',
  source: 'Quartet 1',
  reference: 'A quick reference',
  checkCount: 4,
  exerciseCount: 6,
};
const session: LearnSession = {
  id: 'session',
  lessonId: 'rashii',
  version: 1,
  busy: false,
  updatedAt: '',
  state: { phase: 'check', index: 1, answered: false, turns: [] },
  prompt: {
    id: 'contrast',
    prompt: 'Someone says「今日は春らしいね」。What are they saying about today?',
    teaching: {
      title: 'There’s another use of らしい.',
      explanation: 'This describes a typical quality.',
      example: {
        japanese: '今日は暖かくて、春らしいね。',
        english: 'It’s warm today—very springlike.',
      },
    },
  },
};

describe('Conversational lesson steps', () => {
  it('keeps the current explanation, example and self-contained question visible together', () => {
    render(<LearnQuestion session={session} lesson={lesson} />);
    expect(screen.getByRole('heading', { name: 'There’s another use of らしい.' })).toBeVisible();
    expect(screen.getByText('This describes a typical quality.')).toBeVisible();
    expect(screen.getByText('今日は暖かくて、春らしいね。')).toBeVisible();
    expect(
      screen.getByText('Someone says「今日は春らしいね」。What are they saying about today?')
    ).toBeVisible();
    expect(screen.queryByText(/Understanding check/)).not.toBeInTheDocument();
    expect(screen.queryByText(/The idea behind/)).not.toBeInTheDocument();
  });

  it('keeps workbook source references without showing a teaching answer alongside the exercise', () => {
    const exercise: LearnSession = {
      ...session,
      state: { ...session.state, phase: 'exercise', index: 0 },
      prompt: {
        id: 'rumor',
        prompt: 'うわさでは、＿＿＿＿らしい。',
        source: 'Workbook p. 14 · §4.1 (1)',
      },
    };
    render(<LearnQuestion session={exercise} lesson={lesson} />);
    expect(screen.getByText('うわさでは、＿＿＿＿らしい。')).toBeVisible();
    expect(screen.getByText('Workbook p. 14 · §4.1 (1)')).toBeVisible();
    expect(screen.queryByText('This describes a typical quality.')).not.toBeInTheDocument();
  });

  it('retains teaching context in history and hides old redundant check labels', () => {
    render(
      <LearnExchange
        showPrompt
        turn={{
          id: 'answer',
          stepKey: 'check:1',
          kind: 'answer',
          text: 'Springlike.',
          message: 'Yes.',
          segments: [],
          prompt: { ...session.prompt!, source: 'Understanding check · ConvoLab' },
        }}
      />
    );
    expect(screen.getByText('This describes a typical quality.')).toBeVisible();
    expect(screen.getByText('Springlike.')).toBeVisible();
    expect(screen.queryByText('Understanding check · ConvoLab')).not.toBeInTheDocument();
  });
});
