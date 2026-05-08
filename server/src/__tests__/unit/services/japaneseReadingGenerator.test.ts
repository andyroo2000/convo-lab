import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateCoreLlmJsonTextMock } = vi.hoisted(() => ({
  generateCoreLlmJsonTextMock: vi.fn(),
}));

vi.mock('../../../services/coreLlmClient.js', () => ({
  generateCoreLlmJsonText: generateCoreLlmJsonTextMock,
}));

describe('japaneseReadingGenerator', () => {
  beforeEach(() => {
    generateCoreLlmJsonTextMock.mockReset();
  });

  it('batches multiple kanji texts into one provider call', async () => {
    const { generateJapaneseReadings } =
      await import('../../../services/japaneseReadingGenerator.js');
    generateCoreLlmJsonTextMock.mockImplementation((prompt: string) => {
      const payload = JSON.parse(prompt) as { items: Array<{ id: string; text: string }> };
      return Promise.resolve(
        JSON.stringify({
          readings: payload.items.map((item) => ({
            id: item.id,
            reading:
              item.text === '会社に行きます。'
                ? '会社[かいしゃ]に行[い]きます。'
                : '北海道[ほっかいどう]です。',
          })),
        })
      );
    });

    await expect(generateJapaneseReadings(['会社に行きます。', '北海道です。'])).resolves.toEqual([
      '会社[かいしゃ]に行[い]きます。',
      '北海道[ほっかいどう]です。',
    ]);
    expect(generateCoreLlmJsonTextMock).toHaveBeenCalledTimes(1);
  });

  it('returns kana and empty text without calling the provider', async () => {
    const { generateJapaneseReadings } =
      await import('../../../services/japaneseReadingGenerator.js');

    await expect(generateJapaneseReadings(['こんにちは', '', 'カタカナ'])).resolves.toEqual([
      'こんにちは',
      '',
      'カタカナ',
    ]);
    expect(generateCoreLlmJsonTextMock).not.toHaveBeenCalled();
  });

  it('accepts valid bracket notation', async () => {
    const { generateJapaneseReading } =
      await import('../../../services/japaneseReadingGenerator.js');
    generateCoreLlmJsonTextMock.mockResolvedValueOnce(
      JSON.stringify({
        readings: [{ id: '0', reading: '予定[よてい]があります。' }],
      })
    );

    await expect(generateJapaneseReading('予定があります。')).resolves.toBe(
      '予定[よてい]があります。'
    );
  });

  it('rejects unsafe or mismatched output and falls back to the original text', async () => {
    const { generateJapaneseReadings } =
      await import('../../../services/japaneseReadingGenerator.js');
    generateCoreLlmJsonTextMock.mockResolvedValueOnce(
      JSON.stringify({
        readings: [
          { id: '0', reading: '会社[kaisha]です。' },
          { id: '1', reading: '東京[とうきょう]です。' },
        ],
      })
    );

    await expect(generateJapaneseReadings(['会社です。', '大阪です。'])).resolves.toEqual([
      '会社です。',
      '大阪です。',
    ]);
  });

  it('falls back to original text when the provider fails', async () => {
    const { generateJapaneseReading } =
      await import('../../../services/japaneseReadingGenerator.js');
    generateCoreLlmJsonTextMock.mockRejectedValueOnce(new Error('provider down'));

    await expect(generateJapaneseReading('日本に行きます。')).resolves.toBe('日本に行きます。');
  });

  it('fills only missing Japanese L2 script unit readings', async () => {
    const { fillMissingJapaneseReadingsForScriptUnits } =
      await import('../../../services/japaneseReadingGenerator.js');
    generateCoreLlmJsonTextMock.mockResolvedValueOnce(
      JSON.stringify({
        readings: [{ id: '0', reading: '会社[かいしゃ]に行[い]きます。' }],
      })
    );

    await expect(
      fillMissingJapaneseReadingsForScriptUnits(
        [
          { type: 'narration_L1', text: 'Say:', voiceId: 'en-voice' },
          { type: 'L2', text: '会社に行きます。', voiceId: 'ja-voice' },
          { type: 'L2', text: '学校です。', reading: '学校[がっこう]です。', voiceId: 'ja-voice' },
          { type: 'pause', seconds: 1 },
        ],
        'ja'
      )
    ).resolves.toEqual([
      { type: 'narration_L1', text: 'Say:', voiceId: 'en-voice' },
      {
        type: 'L2',
        text: '会社に行きます。',
        reading: '会社[かいしゃ]に行[い]きます。',
        voiceId: 'ja-voice',
      },
      { type: 'L2', text: '学校です。', reading: '学校[がっこう]です。', voiceId: 'ja-voice' },
      { type: 'pause', seconds: 1 },
    ]);
  });
});
