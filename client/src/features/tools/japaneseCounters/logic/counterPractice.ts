export type CounterId = 'mai' | 'hon' | 'hiki';

export type CounterIllustrationId =
  | 'paper-sheet'
  | 'postcard'
  | 'tshirt'
  | 'pencil'
  | 'umbrella'
  | 'banana'
  | 'cat'
  | 'dog'
  | 'fish';

interface CounterReading {
  value: number;
  script: string;
  kana: string;
}

export interface CounterOption {
  id: CounterId;
  symbol: string;
  kana: string;
  hint: string;
  example: string;
}

export interface CounterObject {
  id: string;
  counterId: CounterId;
  script: string;
  kana: string;
  englishLabel: string;
  illustrationId: CounterIllustrationId;
}

export interface CounterPracticeCard {
  id: string;
  counterId: CounterId;
  counterSymbol: string;
  counterKana: string;
  counterHint: string;
  quantity: number;
  countScript: string;
  countKana: string;
  object: CounterObject;
}

const COUNTER_OPTIONS: CounterOption[] = [
  {
    id: 'mai',
    symbol: '枚',
    kana: 'まい',
    hint: 'flat things',
    example: '紙, シャツ',
  },
  {
    id: 'hon',
    symbol: '本',
    kana: 'ほん',
    hint: 'long objects',
    example: 'ペン, 傘',
  },
  {
    id: 'hiki',
    symbol: '匹',
    kana: 'ひき',
    hint: 'small animals',
    example: '猫, 犬',
  },
];

const COUNTER_OPTIONS_BY_ID: Record<CounterId, CounterOption> = {
  mai: COUNTER_OPTIONS[0],
  hon: COUNTER_OPTIONS[1],
  hiki: COUNTER_OPTIONS[2],
};

const COUNTER_OBJECTS: Record<CounterId, CounterObject[]> = {
  mai: [
    {
      id: 'paper',
      counterId: 'mai',
      script: '紙',
      kana: 'かみ',
      englishLabel: 'sheet of paper',
      illustrationId: 'paper-sheet',
    },
    {
      id: 'postcard',
      counterId: 'mai',
      script: '葉書',
      kana: 'はがき',
      englishLabel: 'postcard',
      illustrationId: 'postcard',
    },
    {
      id: 'tshirt',
      counterId: 'mai',
      script: 'Tシャツ',
      kana: 'てぃーしゃつ',
      englishLabel: 't-shirt',
      illustrationId: 'tshirt',
    },
  ],
  hon: [
    {
      id: 'pencil',
      counterId: 'hon',
      script: '鉛筆',
      kana: 'えんぴつ',
      englishLabel: 'pencil',
      illustrationId: 'pencil',
    },
    {
      id: 'umbrella',
      counterId: 'hon',
      script: '傘',
      kana: 'かさ',
      englishLabel: 'umbrella',
      illustrationId: 'umbrella',
    },
    {
      id: 'banana',
      counterId: 'hon',
      script: 'バナナ',
      kana: 'ばなな',
      englishLabel: 'banana',
      illustrationId: 'banana',
    },
  ],
  hiki: [
    {
      id: 'cat',
      counterId: 'hiki',
      script: '猫',
      kana: 'ねこ',
      englishLabel: 'cat',
      illustrationId: 'cat',
    },
    {
      id: 'dog',
      counterId: 'hiki',
      script: '犬',
      kana: 'いぬ',
      englishLabel: 'dog',
      illustrationId: 'dog',
    },
    {
      id: 'fish',
      counterId: 'hiki',
      script: '魚',
      kana: 'さかな',
      englishLabel: 'fish',
      illustrationId: 'fish',
    },
  ],
};

const COUNTER_READINGS: Record<CounterId, CounterReading[]> = {
  mai: [
    { value: 1, script: '一枚', kana: 'いちまい' },
    { value: 2, script: '二枚', kana: 'にまい' },
    { value: 3, script: '三枚', kana: 'さんまい' },
    { value: 4, script: '四枚', kana: 'よんまい' },
    { value: 5, script: '五枚', kana: 'ごまい' },
    { value: 6, script: '六枚', kana: 'ろくまい' },
    { value: 7, script: '七枚', kana: 'ななまい' },
    { value: 8, script: '八枚', kana: 'はちまい' },
    { value: 9, script: '九枚', kana: 'きゅうまい' },
    { value: 10, script: '十枚', kana: 'じゅうまい' },
  ],
  hon: [
    { value: 1, script: '一本', kana: 'いっぽん' },
    { value: 2, script: '二本', kana: 'にほん' },
    { value: 3, script: '三本', kana: 'さんぼん' },
    { value: 4, script: '四本', kana: 'よんほん' },
    { value: 5, script: '五本', kana: 'ごほん' },
    { value: 6, script: '六本', kana: 'ろっぽん' },
    { value: 7, script: '七本', kana: 'ななほん' },
    { value: 8, script: '八本', kana: 'はっぽん' },
    { value: 9, script: '九本', kana: 'きゅうほん' },
    { value: 10, script: '十本', kana: 'じゅっぽん' },
  ],
  hiki: [
    { value: 1, script: '一匹', kana: 'いっぴき' },
    { value: 2, script: '二匹', kana: 'にひき' },
    { value: 3, script: '三匹', kana: 'さんびき' },
    { value: 4, script: '四匹', kana: 'よんひき' },
    { value: 5, script: '五匹', kana: 'ごひき' },
    { value: 6, script: '六匹', kana: 'ろっぴき' },
    { value: 7, script: '七匹', kana: 'ななひき' },
    { value: 8, script: '八匹', kana: 'はっぴき' },
    { value: 9, script: '九匹', kana: 'きゅうひき' },
    { value: 10, script: '十匹', kana: 'じゅっぴき' },
  ],
};

export const COUNTER_POOL: CounterOption[] = COUNTER_OPTIONS;
export const DEFAULT_COUNTER_IDS: CounterId[] = ['hon'];

function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function isCounterId(value: string): value is CounterId {
  return value === 'mai' || value === 'hon' || value === 'hiki';
}

export function sanitizeSelectedCounterIds(ids: readonly string[]): CounterId[] {
  const unique = Array.from(new Set(ids)).filter(isCounterId);
  return unique.length > 0 ? unique : DEFAULT_COUNTER_IDS;
}

export function toggleCounterSelection(
  current: readonly CounterId[],
  counterId: CounterId
): CounterId[] {
  if (current.includes(counterId)) {
    if (current.length === 1) {
      return [...current];
    }
    return current.filter((id) => id !== counterId);
  }

  return [...current, counterId];
}

export function createCounterPracticeCard(
  selectedCounterIds: readonly CounterId[]
): CounterPracticeCard {
  const safeCounterIds =
    selectedCounterIds.length > 0 ? [...selectedCounterIds] : [...DEFAULT_COUNTER_IDS];
  const counterId = randomItem(safeCounterIds);
  const counter = COUNTER_OPTIONS_BY_ID[counterId];
  const object = randomItem(COUNTER_OBJECTS[counterId]);
  const reading = randomItem(COUNTER_READINGS[counterId]);

  return {
    id: `${counterId}:${object.id}:${reading.value}:${Math.random().toString(36).slice(2, 8)}`,
    counterId,
    counterSymbol: counter.symbol,
    counterKana: counter.kana,
    counterHint: counter.hint,
    quantity: reading.value,
    countScript: reading.script,
    countKana: reading.kana,
    object,
  };
}
