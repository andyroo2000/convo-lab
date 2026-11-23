import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import JournalEditor from '../JournalEditor';
import useJournalEditor from '../useJournalEditor';
import useJournalAnalysis from '../useJournalAnalysis';

vi.mock('../JournalClarificationDialog', () => ({ default: () => <p>Your tutor is thinking</p> }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 1 } }) }));
vi.mock('../../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ isFeatureEnabled: () => false }),
}));
vi.mock('../useJournalEditor');
vi.mock('../useJournalAnalysis');
vi.mock('../JournalEditorForm', () => ({ default: () => null }));

function show(body: string, status: 'processing' | 'ready') {
  vi.mocked(useJournalEditor).mockReturnValue({
    draft: { body, expectedVersion: 1 },
    canLoadFeedback: true,
    submitted: 1,
    clarification: { active: false },
    acceptGeneratedEntry: vi.fn(),
  } as unknown as ReturnType<typeof useJournalEditor>);
  vi.mocked(useJournalAnalysis).mockReturnValue({
    data: { entry: { body: 'original' }, data: { status } },
  } as ReturnType<typeof useJournalAnalysis>);
  return render(
    <JournalEditor
      ownerId="a"
      entryId="entry"
      onSaved={vi.fn()}
      onOpen={vi.fn()}
      renderFeedback={() => <p>Corrections</p>}
    />
  );
}

it.each(['processing', 'ready'] as const)('shows %s only for the current diary text', (status) => {
  const { unmount } = show('edited', status);
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  expect(screen.queryByText('Corrections')).not.toBeInTheDocument();
  unmount();
  show('original', status);
  expect(
    screen.getByText(status === 'ready' ? 'Corrections' : 'Your tutor is thinking')
  ).toBeInTheDocument();
});

it('shows the tutor 404 for a missing entry without displaying raw errors or feedback', () => {
  vi.mocked(useJournalEditor).mockReturnValue({
    draft: null,
    notFound: true,
    error: 'No query results for model App\\JournalEntry',
    clarification: { active: false },
  } as unknown as ReturnType<typeof useJournalEditor>);
  vi.mocked(useJournalAnalysis).mockReturnValue({} as ReturnType<typeof useJournalAnalysis>);
  render(
    <MemoryRouter>
      <JournalEditor ownerId="a" entryId="missing" onSaved={vi.fn()} onOpen={vi.fn()} />
    </MemoryRouter>
  );
  expect(screen.getByRole('heading', { name: /404.*Page Not Found/ })).toBeInTheDocument();
  expect(screen.queryByText(/No query results/)).not.toBeInTheDocument();
  expect(screen.queryByText('Loading entry…')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to Journal' })).toHaveAttribute(
    'href',
    '/app/journal'
  );
});

it('keeps feedback and its cached error out of the recovery editor for local writing', () => {
  vi.mocked(useJournalEditor).mockReturnValue({
    draft: { body: '昨日書いた。', expectedVersion: 1 },
    canLoadFeedback: false,
    locallySaved: true,
    error: 'This entry is unavailable online. Your writing is still here.',
    conflict: true,
    clarification: { active: false },
  } as unknown as ReturnType<typeof useJournalEditor>);
  vi.mocked(useJournalAnalysis).mockReturnValue({
    error: new Error('Not found'),
    data: { entry: { body: '昨日書いた。' }, data: { status: 'ready' } },
  } as unknown as ReturnType<typeof useJournalAnalysis>);
  render(<JournalEditor ownerId="a" entryId="local-edit" onSaved={vi.fn()} onOpen={vi.fn()} />);
  expect(useJournalAnalysis).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  expect(screen.getByRole('button', { name: 'Save my writing as a new entry' })).toBeVisible();
  expect(screen.queryByText(/Could not load feedback/)).toBeNull();
});
