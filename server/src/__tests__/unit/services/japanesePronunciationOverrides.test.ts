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
  forceKana: {
    北海道: 'ほっかいどう',
    物価: 'ぶっか',
  },
  verbKana: {
    話す: 'はなす',
  },
  updatedAt: '2024-01-01T00:00:00.000Z',
});

describe('japanesePronunciationOverrides', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockFs.__setFile(dictionaryJson);
    delete process.env.PRONUNCIATION_DICTIONARY_PATH;
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

    const ambiguousKanji = module.applyJapanesePronunciationOverrides({
      text: '物価',
    });
    expect(ambiguousKanji).toBe('ぶっか');
  });

  it('normalizes standalone kana particles for TTS-only pronunciation text', async () => {
    const module = await import('../../../services/japanesePronunciationOverrides.js');

    const result = module.applyJapanesePronunciationOverrides({
      text: '昨日は辛いカレーを食べられませんでした。',
      reading: '昨日[きのう]は辛[から]いカレーを食[た]べられませんでした。',
    });

    expect(result).toBe('きのうわからいカレーをたべられませんでした。');
  });

  it('collapses overlapping bracket readings for Japanese TTS text', async () => {
    const module = await import('../../../services/japanesePronunciationOverrides.js');

    const result = module.applyJapanesePronunciationOverrides({
      text: '今朝は買い物したかったです。',
      reading: '今朝[けさ]は買[か]い物[かいもの]したかったです。',
    });

    expect(result).toBe('けさわかいものしたかったです。');
  });

  it('does not duplicate numeric year surfaces when bracket readings include the year', async () => {
    const module = await import('../../../services/japanesePronunciationOverrides.js');

    const result = module.applyJapanesePronunciationOverrides({
      text: '2010年でした。',
      reading: '2010年[二千十ねん]でした。',
    });

    expect(result).toBe('二千十ねんでした。');
  });

  it('preserves number readings when year ranges annotate digits before 年', async () => {
    const module = await import('../../../services/japanesePronunciationOverrides.js');

    const result = module.applyJapanesePronunciationOverrides({
      text: '2010年から2011年まで日本に住んでいました。',
      reading:
        '2010[にせんじゅう]年から2011[にせんじゅういち]年まで日本[にほん]に住[す]んでいました。',
    });

    expect(result).toBe('にせんじゅう年からにせんじゅういち年までにほんにすんでいました。');
  });

  it('derives verb-stem overrides when generated furigana misreads 話し inflections', async () => {
    const module = await import('../../../services/japanesePronunciationOverrides.js');

    const conditional = module.applyJapanesePronunciationOverrides({
      text: '日本人と話したら',
      reading: '日本人[にほんじん]と話[わな]したら',
    });
    expect(conditional).toBe('にほんじんとはなしたら');

    const invitation = module.applyJapanesePronunciationOverrides({
      text: '時間があったら、公園で少し話しませんか。',
      reading: '時間[じかん]があったら、公園[こうえん]で少[すこ]し話[わな]しませんか。',
    });
    expect(invitation).toBe('じかんがあったら、こうえんですこしはなしませんか。');
  });

  it('derives verb-stem overrides for godan る verbs', async () => {
    mockFs.__setFile(
      JSON.stringify({
        keepKanji: [],
        forceKana: {},
        verbKana: { 帰る: 'かえる' },
      })
    );
    const module = await import('../../../services/japanesePronunciationOverrides.js');

    const result = module.applyJapanesePronunciationOverrides({
      text: '家に帰りたいです。',
      reading: '家[いえ]に帰[き]りたいです。',
    });

    expect(result).toBe('いえにかえりたいです。');
  });

  it('loads older dictionaries without verb-kana entries', async () => {
    mockFs.__setFile(
      JSON.stringify({
        keepKanji: ['橋'],
        forceKana: { 北海道: 'ほっかいどう' },
      })
    );

    const module = await import('../../../services/japanesePronunciationOverrides.js');

    const dictionary = module.getJapanesePronunciationDictionary();
    expect(dictionary.keepKanji).toContain('橋');
    expect(dictionary.forceKana).toHaveProperty('北海道', 'ほっかいどう');
    expect(dictionary.verbKana).toEqual({});
  });

  it('lets explicit force-kana entries override derived verb entries', async () => {
    mockFs.__setFile(
      JSON.stringify({
        keepKanji: [],
        forceKana: { 話し: 'テスト' },
        verbKana: { 話す: 'はなす' },
      })
    );
    const module = await import('../../../services/japanesePronunciationOverrides.js');

    const result = module.applyJapanesePronunciationOverrides({
      text: '話しました。',
      reading: '話[わな]しました。',
    });

    expect(result).toBe('テストました。');
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
    expect(after.forceKana).toHaveProperty('物価', 'ぶっか');
    expect(after.verbKana).toHaveProperty('話す', 'はなす');
  });

  it('updates dictionary after successful write', async () => {
    const module = await import('../../../services/japanesePronunciationOverrides.js');

    await module.updateJapanesePronunciationDictionary({
      keepKanji: ['端'],
      forceKana: { 東京: 'とうきょう' },
      verbKana: { 書く: 'かく' },
    });

    const updated = module.getJapanesePronunciationDictionary();
    expect(updated.keepKanji).toContain('端');
    expect(updated.forceKana).toHaveProperty('東京', 'とうきょう');
    expect(updated.verbKana).toHaveProperty('書く', 'かく');
  });

  it('preserves existing verb-kana entries when update payload omits them', async () => {
    const module = await import('../../../services/japanesePronunciationOverrides.js');

    await module.updateJapanesePronunciationDictionary({
      keepKanji: ['端'],
      forceKana: { 東京: 'とうきょう' },
    });

    const updated = module.getJapanesePronunciationDictionary();
    expect(updated.verbKana).toHaveProperty('話す', 'はなす');
  });

  it('skips overrides for excessively long text', async () => {
    const module = await import('../../../services/japanesePronunciationOverrides.js');

    const longText = `北海道${'あ'.repeat(12000)}`;
    const result = module.applyJapanesePronunciationOverrides({ text: longText });

    expect(result).toBe(longText);
  });

  it('coalesces concurrent lazy loads', async () => {
    const module = await import('../../../services/japanesePronunciationOverrides.js');
    mockFs.readFileSync.mockClear();

    await Promise.all([
      module.updateJapanesePronunciationDictionary({
        keepKanji: ['端'],
        forceKana: { 東京: 'とうきょう' },
      }),
      module.updateJapanesePronunciationDictionary({
        keepKanji: ['橋'],
        forceKana: { 大阪: 'おおさか' },
      }),
    ]);

    expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
  });

  it('rejects override paths outside the server root', async () => {
    process.env.PRONUNCIATION_DICTIONARY_PATH = '/tmp/pronunciation.json';

    await expect(import('../../../services/japanesePronunciationOverrides.js')).rejects.toThrow(
      'within server root'
    );
  });
});
