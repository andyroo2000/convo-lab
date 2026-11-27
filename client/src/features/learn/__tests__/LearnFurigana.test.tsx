import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KnownKanjiContextProvider } from '../../../contexts/KnownKanjiContext';
import { LearnQuestion } from '../LearnLessonContent';
import { LearnExchange } from '../LearnTranscript';
import type { LearnLesson, LearnSession } from '../types';

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
  prompt: {
    id: 'meaning',
    prompt: 'What does 学生[がくせい] mean?',
    teaching: {
      title: 'An example',
      explanation: 'Use 学生[がくせい] after a noun.',
      example: {
        japanese: '田中[たなか]さんは学生[がくせい]らしい。',
        english: 'Apparently Tanaka is a student.',
      },
    },
  },
};

const TeachingWithKnowledge = ({ known, active = true }: { known: string[]; active?: boolean }) => (
  <KnownKanjiContextProvider active={active} knownKanji={new Set(known)}>
    <LearnQuestion lesson={lesson} session={session} />
  </KnownKanjiContextProvider>
);

describe('Learn WaniKani-aware furigana', () => {
  it('covers explanations, examples and questions and updates when known kanji change', () => {
    const { rerender } = render(<TeachingWithKnowledge known={['学']} />);
    const readings = screen.getAllByText('がくせい');
    expect(readings).toHaveLength(3);
    readings.forEach((reading) => expect(reading).not.toHaveClass('invisible'));
    rerender(<TeachingWithKnowledge known={['学', '生']} />);
    screen.getAllByText('がくせい').forEach((reading) => {
      expect(reading).toHaveClass('invisible');
      expect(reading).toHaveAttribute('aria-hidden', 'true');
    });
    expect(screen.getByText('たなか')).not.toHaveClass('invisible');
  });

  it('shows readings while kanji knowledge is unavailable', () => {
    render(<TeachingWithKnowledge known={['学', '生']} active={false} />);
    screen
      .getAllByText('がくせい')
      .forEach((reading) => expect(reading).not.toHaveClass('invisible'));
  });

  it('uses the same kanji knowledge for tutor follow-up explanations', () => {
    render(
      <KnownKanjiContextProvider active knownKanji={new Set(['予', '定'])}>
        <LearnExchange
          turn={{
            id: 't',
            stepKey: 'check:0',
            kind: 'clarify',
            text: 'Why?',
            message: '予定[よてい] means plan; 学生[がくせい] means student.',
            segments: [],
          }}
        />
      </KnownKanjiContextProvider>
    );
    expect(screen.getByText('よてい')).toHaveClass('invisible');
    expect(screen.getByText('がくせい')).not.toHaveClass('invisible');
  });
});
