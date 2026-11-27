import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LearnTutorCard from '../LearnTutorCard';
import useLearnTutor from '../useLearnTutor';
import { LearnQuestion } from '../LearnLessonContent';
import type { LearnLesson, LearnSession } from '../types';

const tutors = [
  { id: 'hana', name: 'Hana', gender: 'F', avatar: 'hana', avatarUrl: '/hana.png' },
  { id: 'ren', name: 'Ren', gender: 'M', avatar: 'ren', avatarUrl: '/ren.png' },
];
const SelectedCard = () => {
  const tutor = useLearnTutor('local-user');
  return <LearnTutorCard tutor={tutor}>What do you think?</LearnTutorCard>;
};
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
    id: 'first',
    prompt: 'What does らしい tell you?',
    teaching: {
      title: 'Apparently',
      explanation: 'Pass on something you heard.',
      example: { japanese: '来ないらしい。', english: 'Apparently not coming.' },
    },
  },
};

describe('Learn tutor cards', () => {
  it.each([
    ['ren', 'Ren', '/ren.png'],
    [null, 'Hana', '/hana.png'],
  ])(
    'uses the Journal preference %s and the API default when unset',
    (selectedId, name, avatar) => {
      const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
      client.setQueryData(['journal-tutor', 'local-user'], { data: { selectedId, tutors } });
      render(
        <QueryClientProvider client={client}>
          <SelectedCard />
        </QueryClientProvider>
      );
      const card = screen.getByRole('region', { name: 'Your tutor' });
      expect(within(card).getByAltText(name)).toHaveAttribute('src', avatar);
    }
  );

  it('places the question in its own tutor card outside the explanation', () => {
    render(<LearnQuestion session={session} lesson={lesson} />);
    const explanation = screen.getByRole('region', { name: 'Explanation' });
    const card = screen.getByRole('region', { name: 'Your tutor' });
    expect(within(explanation).getByText('Pass on something you heard.')).toBeVisible();
    expect(within(explanation).queryByText('What does らしい tell you?')).not.toBeInTheDocument();
    expect(within(card).getByText('What does らしい tell you?')).toBeVisible();
  });
});
