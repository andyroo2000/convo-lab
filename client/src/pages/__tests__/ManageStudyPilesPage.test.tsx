import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ManageStudyPilesPage from '../ManageStudyPilesPage';
import StudyPileShelf from '../../components/study/StudyPileShelf';
import { getStudyPiles, saveStudyPile, type StudyPileCatalog } from '../../lib/studyPilesApi';

vi.mock('../../lib/studyPilesApi', () => ({ getStudyPiles: vi.fn(), saveStudyPile: vi.fn() }));
const counts = { new_count: 12, ready_count: 3, introduced_count: 7 };
const chapter = {
  ...counts,
  id: 'chapter20',
  title: 'Chapter 20',
  position: 20,
  is_active: true,
  source_reference: null,
};
const book = { ...chapter, id: 'genki', title: 'Genki II', chapters: [chapter] };
let catalog: StudyPileCatalog;
const renderPage = (element = <ManageStudyPilesPage />) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <MemoryRouter>{element}</MemoryRouter>
    </QueryClientProvider>
  );

describe('Manage piles', () => {
  beforeEach(() => {
    catalog = {
      piles: [
        structuredClone(book),
        { ...book, id: 'quartet', title: 'Quartet I', is_active: false, chapters: [] },
      ],
      uncategorized: counts,
      learn_soon: counts,
    };
    vi.mocked(getStudyPiles).mockImplementation(async () => structuredClone(catalog));
    vi.mocked(saveStudyPile).mockReset();
  });

  it('parks a book while preserving its enabled chapters', async () => {
    vi.mocked(saveStudyPile).mockImplementation(async (_id, attributes) => {
      Object.assign(catalog.piles[0], attributes);
    });
    renderPage();
    const toggle = await screen.findByRole('checkbox', { name: 'Include Genki II in new cards' });
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(saveStudyPile).toHaveBeenCalledWith('genki', { is_active: false }, undefined)
    );
    await waitFor(() =>
      expect(
        screen.getByRole('checkbox', { name: 'Include Genki II in new cards' })
      ).not.toBeChecked()
    );
    expect(
      screen.getByRole('checkbox', { name: 'Include Chapter 20 in new cards', hidden: true })
    ).toBeChecked();
  });

  it('changes an individual chapter and keeps the book enabled', async () => {
    vi.mocked(saveStudyPile).mockImplementation(async (_id, attributes) => {
      Object.assign(catalog.piles[0].chapters[0], attributes);
    });
    renderPage();
    await screen.findByText('Genki II');
    fireEvent.click(screen.getByText('Chapters (1)'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include Chapter 20 in new cards' }));
    await waitFor(() =>
      expect(saveStudyPile).toHaveBeenCalledWith('chapter20', { is_active: false }, 'genki')
    );
    expect(screen.getByRole('checkbox', { name: 'Include Genki II in new cards' })).toBeChecked();
  });

  it('keeps the server switch value and exposes a failed save', async () => {
    vi.mocked(saveStudyPile).mockRejectedValue(new Error('Unable to save'));
    renderPage();
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Include Genki II in new cards' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to save');
    expect(screen.getByRole('checkbox', { name: 'Include Genki II in new cards' })).toBeChecked();
  });

  it('offers active piles and sends the selected stable ID', async () => {
    const begin = vi.fn();
    renderPage(<StudyPileShelf onBeginLesson={begin} disabled={false} />);
    fireEvent.click(await screen.findByRole('button', { name: /Genki II/ }));
    expect(begin).toHaveBeenCalledWith('genki');
    expect(screen.queryByRole('button', { name: /Quartet/ })).not.toBeInTheDocument();
  });
});
