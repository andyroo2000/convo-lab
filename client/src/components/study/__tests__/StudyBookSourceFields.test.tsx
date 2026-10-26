import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import StudyBookSourceFields from '../piles/StudyBookSourceFields';

vi.mock('../../../hooks/useStudyPiles', () => ({
  useStudyPiles: () => ({
    data: {
      piles: [
        {
          id: 'genki',
          title: 'Genki II',
          is_active: true,
          chapters: [{ id: '20', title: 'Chapter 20' }],
        },
        { id: 'quartet', title: 'Quartet I', is_active: false, chapters: [] },
      ],
    },
  }),
}));

describe('card book sources', () => {
  it('allows assigning parked books without activating them and clears the old chapter', () => {
    const change = vi.fn();
    render(
      <MemoryRouter>
        <StudyBookSourceFields value={{ pileId: 'genki', chapterId: '20' }} onChange={change} />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Book or source' }), {
      target: { value: 'quartet' },
    });
    expect(change).toHaveBeenCalledWith({ pileId: 'quartet' });
  });
  it('keeps order and references while selecting a chapter, and can clear the source', () => {
    const change = vi.fn();
    const source = { pileId: 'genki', position: 5, reference: 'p. 200' };
    render(
      <MemoryRouter>
        <StudyBookSourceFields value={source} onChange={change} />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Chapter' }), {
      target: { value: '20' },
    });
    expect(change).toHaveBeenLastCalledWith({ ...source, chapterId: '20' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Book or source' }), {
      target: { value: '' },
    });
    expect(change).toHaveBeenLastCalledWith(null);
  });
});
