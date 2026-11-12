import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import JournalEditor from '../JournalEditor';
import useJournalEditor from '../useJournalEditor';
import useJournalAnalysis from '../useJournalAnalysis';

vi.mock('../useJournalEditor');
vi.mock('../useJournalAnalysis');
vi.mock('../JournalEditorForm', () => ({ default: () => null }));

function show(body: string, status: 'processing' | 'ready') {
  vi.mocked(useJournalEditor).mockReturnValue({
    draft: { body, expectedVersion: 1 },
    submitted: 1,
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
    screen.getByText(status === 'ready' ? 'Corrections' : 'Reviewing your Japanese…')
  ).toBeInTheDocument();
});
