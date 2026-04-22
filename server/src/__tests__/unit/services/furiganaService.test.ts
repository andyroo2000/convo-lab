import { afterEach, describe, expect, it, vi } from 'vitest';

import { addFuriganaBrackets } from '../../../services/furiganaService.js';

describe('furiganaService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes kuroshiro without constructor interop errors', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await addFuriganaBrackets('予定があるんです');

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(result).toContain('予定');
    expect(result).toContain('よてい');

    consoleLogSpy.mockRestore();
  });
});
