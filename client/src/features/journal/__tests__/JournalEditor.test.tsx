import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import JournalEditor from '../JournalEditor';
import useJournalEditor from '../useJournalEditor';
import useJournalAnalysis from '../useJournalAnalysis';

vi.mock('../JournalClarificationDialog', () => ({ default: () => <p>Your tutor is thinking</p> }));
vi.mock('../useJournalEditor');
vi.mock('../useJournalAnalysis');
vi.mock('../JournalEditorForm', () => ({ default: () => null }));

function show(body: string, status: 'processing' | 'ready') {
  vi.mocked(useJournalEditor).mockReturnValue({
    draft: { body, expectedVersion: 1 },
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
