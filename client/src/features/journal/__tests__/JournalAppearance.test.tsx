import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import JournalAppearance from '../JournalAppearance';
import { readTypography, saveTypography, typographyKey } from '../journalTypography';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
describe('Journal device typography', () => {
  it('defaults to Klee One at desktop size and preserves explicit sans preferences', () => {
    expect(readTypography()).toEqual({ font: 'klee', size: 26 });
    saveTypography({ font: 'sans', size: 20 });
    expect(readTypography()).toEqual({ font: 'sans', size: 20 });
  });
  it('restores the chosen font and size without an account or server', () => {
    expect(saveTypography({ font: 'serif', size: 27 })).toBe(true);
    expect(readTypography()).toEqual({ font: 'serif', size: 27 });
  });
  it.each(['broken', '{"size":null}', '{"size":"24"}'])('uses safe defaults for %s', (stored) => {
    localStorage.setItem(typographyKey, stored);
    expect(readTypography()).toEqual({ font: 'klee', size: 26 });
  });
  it.each([
    [1, 16],
    [300, 30],
  ])('bounds stored size %s to %s', (stored, expected) => {
    localStorage.setItem(typographyKey, JSON.stringify({ font: 'invalid', size: stored }));
    expect(readTypography()).toEqual({ font: 'klee', size: expected });
  });
  it('keeps the Journal usable when storage is denied', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(readTypography()).toEqual({ font: 'klee', size: 26 });
    expect(saveTypography({ font: 'serif', size: 24 })).toBe(false);
  });
  it('offers three font cards and a slider and retains the other preference on change', () => {
    const change = vi.fn();
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function show(this: HTMLDialogElement) {
        this.open = true;
      },
    });
    render(<JournalAppearance value={{ font: 'sans', size: 22 }} onChange={change} saved />);
    fireEvent.click(screen.getByRole('button', { name: 'Journal appearance' }));
    expect(screen.getAllByRole('button', { pressed: false })[0]).toHaveTextContent('Klee One');
    fireEvent.click(screen.getByRole('button', { name: 'Klee One' }));
    expect(change).toHaveBeenLastCalledWith({ font: 'klee', size: 22 });
    fireEvent.click(screen.getByRole('button', { name: 'Serif' }));
    expect(change).toHaveBeenLastCalledWith({ font: 'serif', size: 22 });
    fireEvent.change(screen.getByRole('slider'), { target: { value: '28' } });
    expect(change).toHaveBeenLastCalledWith({ font: 'sans', size: 28 });
  });
});
