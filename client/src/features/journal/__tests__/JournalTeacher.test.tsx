import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import JournalTeacher from '../JournalTeacher';
import { getTutorPreferences, prepareTutorQuestion, saveTutorPreference } from '../journalTutor';
import type { JournalTutor, TutorQuestion } from '../journalTutor';
import type { JournalAnalysis } from '../types';

vi.mock('../journalTutor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../journalTutor')>()),
  getTutorPreferences: vi.fn(),
  saveTutorPreference: vi.fn(),
  prepareTutorQuestion: vi.fn(),
}));
const tutors: JournalTutor[] = [
  { id: 'hana', name: 'Hana', gender: 'F', avatar: 'hana-v1' },
  { id: 'ren', name: 'Ren', gender: 'M', avatar: 'ren-v1' },
];
const analysis: JournalAnalysis = {
  id: 'analysis',
  sourceVersion: 1,
  status: 'ready',
  error: null,
  updatedAt: 'now',
  replyRevision: 0,
  result: {
    title: 'Movie',
    correctedText: '映画を見た。',
    correctedReading: '映画[えいが]を見[み]た。',
    question: '誰と見ましたか。',
    questionReading: '誰[だれ]と見[み]ましたか。',
    questionTranslation: 'Who did you watch it with?',
    segments: [],
  },
};
let selected: string | null;
let question: TutorQuestion;
beforeEach(() => {
  vi.clearAllMocks();
  selected = null;
  question = {
    id: 'question',
    text: '誰と見ましたか。',
    reading: '誰[だれ]と見[み]ましたか。',
    translation: 'Who did you watch it with?',
    tutor: null,
  };
  vi.mocked(getTutorPreferences).mockImplementation(async () => ({
    data: { selectedId: selected, tutors },
  }));
  vi.mocked(saveTutorPreference).mockImplementation(async (id) => {
    selected = id;
    return { data: { selectedId: selected, tutors } };
  });
  vi.mocked(prepareTutorQuestion).mockImplementation(async () => {
    if (!question.tutor)
      question = { ...question, tutor: tutors.find((t) => t.id === selected) ?? null };
    return { data: question };
  });
});
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <JournalTeacher ownerId="a" entryId="entry" analysis={analysis} />
    </QueryClientProvider>
  );
}
it('asks for the first tutor, saves the choice, and shows their portrait with hidden English', async () => {
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Hana (F)' }));
  await screen.findByRole('img', { name: 'Hana, your tutor' });
  expect(saveTutorPreference).toHaveBeenCalledWith('hana', expect.anything());
  expect(screen.queryByRole('region', { name: 'Choose your tutor' })).not.toBeInTheDocument();
  expect(screen.queryByText('Who did you watch it with?')).not.toBeInTheDocument();
  expect(screen.getByText('だれ')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Show English' }));
  expect(screen.getByText('Who did you watch it with?')).toBeInTheDocument();
});
it('changes the account default while keeping the existing question with its original tutor', async () => {
  selected = 'hana';
  [question.tutor] = tutors;
  mount();
  await screen.findByRole('img', { name: 'Hana, your tutor' });
  fireEvent.click(screen.getByRole('button', { name: 'Choose tutor' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Ren (M)' }));
  await waitFor(() => expect(selected).toBe('ren'));
  expect(screen.getByRole('img', { name: 'Hana, your tutor' })).toBeInTheDocument();
  expect(question.tutor?.id).toBe('hana');
});
it('keeps the chooser available when the preference cannot be saved', async () => {
  vi.mocked(saveTutorPreference).mockRejectedValue(new Error('Offline'));
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Hana (F)' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be saved');
  expect(screen.getByRole('button', { name: 'Hana (F)' })).toBeEnabled();
  expect(selected).toBeNull();
});
