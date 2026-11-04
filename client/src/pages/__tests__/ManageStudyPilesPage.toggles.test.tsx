import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ManageStudyPilesPage from '../ManageStudyPilesPage';
import { getStudyPiles, saveStudyPile, type StudyPileCatalog } from '../../lib/studyPilesApi';

vi.mock('../../lib/studyPilesApi', () => ({ getStudyPiles: vi.fn(), saveStudyPile: vi.fn() }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const counts = { new_count: 12, ready_count: 0, introduced_count: 3 };
const chapter = {
  ...counts,
  id: 'grammar1',
  title: 'Grammar 1',
  position: 1,
  is_active: false,
  source_reference: null,
};
let catalog: StudyPileCatalog;

async function renderPiles() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ManageStudyPilesPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
  fireEvent.click(await screen.findByText('Chapters (2)'));
  return { client };
}

const toggle = (title = 'Grammar 1') =>
  screen.getByRole('checkbox', { name: `Include ${title} in new cards` });

describe('Immediate pile switches', () => {
  beforeEach(() => {
    catalog = {
      piles: [
        {
          ...chapter,
          id: 'quartet',
          title: 'Quartet 1',
          is_active: true,
          chapters: [
            { ...chapter },
            { ...chapter, id: 'grammar2', title: 'Grammar 2', position: 2 },
          ],
        },
      ],
      uncategorized: counts,
      learn_soon: counts,
    };
    vi.mocked(getStudyPiles)
      .mockReset()
      .mockImplementation(async () => structuredClone(catalog));
    vi.mocked(saveStudyPile).mockReset();
  });

  it('checks immediately while the chapter save is still pending', async () => {
    const save = deferred<unknown>();
    vi.mocked(saveStudyPile).mockReturnValue(save.promise);
    await renderPiles();
    fireEvent.click(toggle());
    await waitFor(() => expect(toggle()).toBeChecked());
    expect(toggle()).toBeDisabled();
    expect(toggle('Grammar 2')).toBeEnabled();
    expect(toggle('Quartet 1')).toBeChecked();
    await waitFor(() =>
      expect(saveStudyPile).toHaveBeenCalledExactlyOnceWith(
        'grammar1',
        { is_active: true },
        'quartet'
      )
    );
    catalog.piles[0].chapters[0].is_active = true;
    await act(async () => save.resolve({}));
  });

  it('enables the saved checkbox before the counts refresh finishes', async () => {
    const refresh = deferred<StudyPileCatalog>();
    vi.mocked(saveStudyPile).mockResolvedValue({});
    const { client } = await renderPiles();
    vi.mocked(getStudyPiles).mockReturnValueOnce(refresh.promise);
    fireEvent.click(toggle());
    await waitFor(() => expect(getStudyPiles).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(toggle()).toBeEnabled());
    expect(toggle()).toBeChecked();
    expect(
      client.getQueryData<StudyPileCatalog>(['study', 'piles'])?.piles[0].chapters[0].is_active
    ).toBe(true);
    catalog.piles[0].chapters[0].is_active = true;
    await act(async () => refresh.resolve(catalog));
  });

  it('rolls back a failed save and allows a retry', async () => {
    const save = deferred<unknown>();
    vi.mocked(saveStudyPile).mockReturnValueOnce(save.promise);
    await renderPiles();
    fireEvent.click(toggle());
    await waitFor(() => expect(toggle()).toBeChecked());
    await act(async () => save.reject(new Error('Unable to save')));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to save');
    expect(toggle()).not.toBeChecked();
    expect(toggle()).toBeEnabled();
    vi.mocked(saveStudyPile).mockImplementation(async () => {
      catalog.piles[0].chapters[0].is_active = true;
    });
    fireEvent.click(toggle());
    await waitFor(() => expect(toggle()).toBeChecked());
    await waitFor(() => expect(toggle()).toBeEnabled());
    expect(toggle()).toBeChecked();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('preserves another chapter save when an overlapping save fails', async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    vi.mocked(saveStudyPile).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await renderPiles();
    fireEvent.click(toggle());
    await waitFor(() => expect(saveStudyPile).toHaveBeenCalledTimes(1));
    fireEvent.click(toggle('Grammar 2'));
    await waitFor(() => expect(saveStudyPile).toHaveBeenCalledTimes(2));
    catalog.piles[0].chapters[1].is_active = true;
    await act(async () => second.resolve({}));
    await waitFor(() => expect(toggle('Grammar 2')).toBeEnabled());
    expect(toggle('Grammar 2')).toBeChecked();
    expect(toggle()).toBeChecked();
    expect(getStudyPiles).toHaveBeenCalledTimes(1);
    await act(async () => first.reject(new Error('First chapter failed')));
    await screen.findByRole('alert');
    await waitFor(() => expect(getStudyPiles).toHaveBeenCalledTimes(2));
    expect(toggle()).not.toBeChecked();
    expect(toggle('Grammar 2')).toBeChecked();
  });

  it('discards a stale refresh that started during a save', async () => {
    const save = deferred<unknown>();
    const stale = deferred<StudyPileCatalog>();
    const refresh = deferred<StudyPileCatalog>();
    vi.mocked(saveStudyPile).mockReturnValue(save.promise);
    const { client } = await renderPiles();
    fireEvent.click(toggle());
    await waitFor(() => expect(saveStudyPile).toHaveBeenCalledTimes(1));
    vi.mocked(getStudyPiles)
      .mockReturnValueOnce(stale.promise)
      .mockReturnValueOnce(refresh.promise);
    let staleRequest: Promise<void>;
    await act(async () => {
      staleRequest = client.refetchQueries({ queryKey: ['study', 'piles'] });
    });
    const staleCatalog = structuredClone(catalog);
    catalog.piles[0].chapters[0].is_active = true;
    await act(async () => save.resolve({}));
    await waitFor(() => expect(toggle()).toBeEnabled());
    await act(async () => {
      stale.resolve(staleCatalog);
      await staleRequest;
    });
    expect(toggle()).toBeChecked();
    await act(async () => refresh.resolve(catalog));
  });

  it('allows another toggle while the previous refresh is pending', async () => {
    const oldRefresh = deferred<StudyPileCatalog>();
    const secondSave = deferred<unknown>();
    vi.mocked(saveStudyPile).mockResolvedValueOnce({}).mockReturnValueOnce(secondSave.promise);
    await renderPiles();
    vi.mocked(getStudyPiles).mockReturnValueOnce(oldRefresh.promise);
    fireEvent.click(toggle());
    await waitFor(() => expect(toggle()).toBeChecked());
    await waitFor(() => expect(toggle()).toBeEnabled());
    expect(toggle()).toBeChecked();
    const oldCatalog = structuredClone(catalog);
    oldCatalog.piles[0].chapters[0].is_active = true;
    fireEvent.click(toggle());
    await waitFor(() => expect(saveStudyPile).toHaveBeenCalledTimes(2));
    await act(async () => oldRefresh.resolve(oldCatalog));
    expect(toggle()).not.toBeChecked();
    await act(async () => secondSave.resolve({}));
    await waitFor(() => expect(toggle()).toBeEnabled());
    expect(toggle()).not.toBeChecked();
  });

  it('does not roll back a successful save when refreshing counts fails', async () => {
    vi.mocked(saveStudyPile).mockResolvedValue({});
    await renderPiles();
    vi.mocked(getStudyPiles).mockRejectedValueOnce(new Error('Refresh unavailable'));
    fireEvent.click(toggle());
    expect(await screen.findByRole('alert')).toHaveTextContent('Refresh unavailable');
    await waitFor(() => expect(toggle()).toBeEnabled());
    expect(toggle()).toBeChecked();
  });
});
