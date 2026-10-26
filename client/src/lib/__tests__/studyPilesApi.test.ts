import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestJson } from '../apiClient';
import { getStudyPiles, saveStudyPile } from '../studyPilesApi';

vi.mock('../apiClient', () => ({ requestJson: vi.fn() }));

describe('pile API', () => {
  beforeEach(() => vi.mocked(requestJson).mockReset());
  it('loads all catalog pages in cursor order', async () => {
    vi.mocked(requestJson)
      .mockResolvedValueOnce({ piles: [{ id: 'one' }], next_cursor: 100 })
      .mockResolvedValueOnce({ piles: [{ id: 'two' }], next_cursor: null });
    expect((await getStudyPiles()).piles.map((pile) => pile.id)).toEqual(['one', 'two']);
    expect(requestJson).toHaveBeenLastCalledWith('/api/study/piles?limit=100&cursor=100');
  });
  it('rejects a nonadvancing cursor instead of looping', async () => {
    vi.mocked(requestJson).mockResolvedValue({ piles: [], next_cursor: 0 });
    await expect(getStudyPiles()).rejects.toThrow('Invalid pile pagination');
  });
  it('sends sparse chapter switches without overwriting title or order', async () => {
    await saveStudyPile('chapter', { is_active: false }, 'book');
    expect(requestJson).toHaveBeenCalledWith('/api/study/piles/book/chapters/chapter', {
      method: 'PUT',
      body: JSON.stringify({ is_active: false }),
    });
  });
});
