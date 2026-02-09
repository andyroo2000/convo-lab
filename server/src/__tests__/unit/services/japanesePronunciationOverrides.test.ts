import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFs = vi.hoisted(() => {
  let fileText = '';
  let exists = false;

  const existsSync = vi.fn(() => exists);
  const readFileSync = vi.fn(() => fileText);
  const writeFileSync = vi.fn((_path: string, data: string) => {
    fileText = String(data);
    exists = true;
  });
  const mkdirSync = vi.fn();

  const promises = {
    mkdir: vi.fn(async () => undefined),
    writeFile: vi.fn(async (_path: string, data: string) => {
      fileText = String(data);
      exists = true;
    }),
  };

  return {
    existsSync,
    readFileSync,
    writeFileSync,
    mkdirSync,
    promises,
    __setFile: (text: string) => {
      fileText = text;
      exists = true;
    },
    __setExists: (value: boolean) => {
      exists = value;
      if (!value) fileText = '';
    },
    __getFile: () => fileText,
  };
});

vi.mock('fs', () => mockFs);

const dictionaryJson = JSON.stringify({
  keepKanji: ['橋'],
  forceKana: { 北海道: 'ほっかいどう' },
  updatedAt: '2024-01-01T00:00:00.000Z',
});

describe('japanesePronunciationOverrides', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockFs.__setFile(dictionaryJson);
  });

  it('lazy loads dictionary on first access', async () => {
    mockFs.readFileSync.mockClear();

    const module = await import('../../../services/japanesePronunciationOverrides.js');

    expect(mockFs.readFileSync).not.toHaveBeenCalled();

    const dict = module.getJapanesePronunciationDictionary();
    expect(dict.keepKanji).toContain('橋');
    expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
  });

  it('applies keep-kanji and force-kana overrides', async () => {
    const module = await import('../../../services/japanesePronunciationOverrides.js');

    const keep = module.applyJapanesePronunciationOverrides({
      text: '橋を渡る',
      reading: '橋[はし]を渡[わた]る',
    });
    expect(keep).toBe('橋をわたる');

    const forced = module.applyJapanesePronunciationOverrides({
      text: '北海道',
    });
    expect(forced).toBe('ほっかいどう');
  });

  it('does not update in-memory state if disk write fails', async () => {
    const module = await import('../../../services/japanesePronunciationOverrides.js');

    const initial = module.getJapanesePronunciationDictionary();
    expect(initial.keepKanji).toContain('橋');

    mockFs.promises.writeFile.mockRejectedValueOnce(new Error('write failed'));

    await expect(
      module.updateJapanesePronunciationDictionary({
        keepKanji: ['端'],
        forceKana: { 東京: 'とうきょう' },
      })
    ).rejects.toThrow('write failed');

    const after = module.getJapanesePronunciationDictionary();
    expect(after.keepKanji).toContain('橋');
    expect(after.forceKana).toHaveProperty('北海道', 'ほっかいどう');
  });

  it('updates dictionary after successful write', async () => {
    const module = await import('../../../services/japanesePronunciationOverrides.js');

    await module.updateJapanesePronunciationDictionary({
      keepKanji: ['端'],
      forceKana: { 東京: 'とうきょう' },
    });

    const updated = module.getJapanesePronunciationDictionary();
    expect(updated.keepKanji).toContain('端');
    expect(updated.forceKana).toHaveProperty('東京', 'とうきょう');
  });
});
