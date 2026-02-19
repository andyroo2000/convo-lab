export type CounterId =
  | 'mai'
  | 'hon'
  | 'hiki'
  | 'satsu'
  | 'dai'
  | 'ko'
  | 'nin'
  | 'hai'
  | 'chaku'
  | 'soku'
  | 'wa'
  | 'kai';

export type CounterIllustrationId =
  | 'paper-sheet'
  | 'postcard'
  | 'tshirt'
  | 'pencil'
  | 'umbrella'
  | 'banana'
  | 'cat'
  | 'dog'
  | 'fish'
  | 'book'
  | 'notebook'
  | 'magazine'
  | 'car'
  | 'bicycle'
  | 'camera'
  | 'apple'
  | 'egg'
  | 'onigiri'
  | 'student'
  | 'teacher'
  | 'doctor'
  | 'coffee-cup'
  | 'tea-cup'
  | 'beer-glass'
  | 'jacket'
  | 'kimono'
  | 'coat'
  | 'sneakers'
  | 'socks'
  | 'boots'
  | 'bird'
  | 'rabbit'
  | 'chicken'
  | 'apartment-building'
  | 'hotel-building'
  | 'mall-building';

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
  particle?: 'を' | 'の';
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
  particle: 'を' | 'の';
  object: CounterObject;
}

export interface CounterPhraseCatalogEntry {
  id: string;
  counterId: CounterId;
  objectId: string;
  quantity: number;
  text: string;
  kanaText: string;
  relativePath: string;
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
  {
    id: 'satsu',
    symbol: '冊',
    kana: 'さつ',
    hint: 'bound volumes',
    example: '本, ノート',
  },
  {
    id: 'dai',
    symbol: '台',
    kana: 'だい',
    hint: 'machines & vehicles',
    example: '車, カメラ',
  },
  {
    id: 'ko',
    symbol: '個',
    kana: 'こ',
    hint: 'small objects',
    example: 'りんご, 卵',
  },
  {
    id: 'nin',
    symbol: '人',
    kana: 'にん',
    hint: 'people',
    example: '学生, 先生',
  },
  {
    id: 'hai',
    symbol: '杯',
    kana: 'はい',
    hint: 'cups / glasses',
    example: 'コーヒー, ビール',
  },
  {
    id: 'chaku',
    symbol: '着',
    kana: 'ちゃく',
    hint: 'clothing',
    example: '着物, コート',
  },
  {
    id: 'soku',
    symbol: '足',
    kana: 'そく',
    hint: 'pairs of footwear',
    example: '靴, 靴下',
  },
  {
    id: 'wa',
    symbol: '羽',
    kana: 'わ',
    hint: 'birds & rabbits',
    example: '鳥, うさぎ',
  },
  {
    id: 'kai',
    symbol: '階',
    kana: 'かい',
    hint: 'floors of buildings',
    example: 'ホテル, デパート',
  },
];

const COUNTER_OPTIONS_BY_ID: Record<CounterId, CounterOption> = COUNTER_OPTIONS.reduce(
  (acc, option) => {
    acc[option.id] = option;
    return acc;
  },
  {} as Record<CounterId, CounterOption>
);
const COUNTER_ID_SET = new Set<CounterId>(COUNTER_OPTIONS.map((option) => option.id));

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
  satsu: [
    {
      id: 'book',
      counterId: 'satsu',
      script: '本',
      kana: 'ほん',
      englishLabel: 'book',
      illustrationId: 'book',
    },
    {
      id: 'notebook',
      counterId: 'satsu',
      script: 'ノート',
      kana: 'のーと',
      englishLabel: 'notebook',
      illustrationId: 'notebook',
    },
    {
      id: 'magazine',
      counterId: 'satsu',
      script: '雑誌',
      kana: 'ざっし',
      englishLabel: 'magazine',
      illustrationId: 'magazine',
    },
  ],
  dai: [
    {
      id: 'car',
      counterId: 'dai',
      script: '車',
      kana: 'くるま',
      englishLabel: 'car',
      illustrationId: 'car',
    },
    {
      id: 'bicycle',
      counterId: 'dai',
      script: '自転車',
      kana: 'じてんしゃ',
      englishLabel: 'bicycle',
      illustrationId: 'bicycle',
    },
    {
      id: 'camera',
      counterId: 'dai',
      script: 'カメラ',
      kana: 'かめら',
      englishLabel: 'camera',
      illustrationId: 'camera',
    },
  ],
  ko: [
    {
      id: 'apple',
      counterId: 'ko',
      script: 'りんご',
      kana: 'りんご',
      englishLabel: 'apple',
      illustrationId: 'apple',
    },
    {
      id: 'egg',
      counterId: 'ko',
      script: '卵',
      kana: 'たまご',
      englishLabel: 'egg',
      illustrationId: 'egg',
    },
    {
      id: 'onigiri',
      counterId: 'ko',
      script: 'おにぎり',
      kana: 'おにぎり',
      englishLabel: 'onigiri',
      illustrationId: 'onigiri',
    },
  ],
  nin: [
    {
      id: 'person',
      counterId: 'nin',
      script: '人',
      kana: 'ひと',
      englishLabel: 'person',
      illustrationId: 'student',
    },
  ],
  hai: [
    {
      id: 'coffee',
      counterId: 'hai',
      script: 'コーヒー',
      kana: 'こーひー',
      englishLabel: 'cup of coffee',
      illustrationId: 'coffee-cup',
    },
    {
      id: 'tea',
      counterId: 'hai',
      script: 'お茶',
      kana: 'おちゃ',
      englishLabel: 'cup of tea',
      illustrationId: 'tea-cup',
    },
    {
      id: 'beer',
      counterId: 'hai',
      script: 'ビール',
      kana: 'びーる',
      englishLabel: 'glass of beer',
      illustrationId: 'beer-glass',
    },
  ],
  chaku: [
    {
      id: 'jacket',
      counterId: 'chaku',
      script: 'ジャケット',
      kana: 'じゃけっと',
      englishLabel: 'jacket',
      illustrationId: 'jacket',
    },
    {
      id: 'kimono',
      counterId: 'chaku',
      script: '着物',
      kana: 'きもの',
      englishLabel: 'kimono',
      illustrationId: 'kimono',
    },
    {
      id: 'coat',
      counterId: 'chaku',
      script: 'コート',
      kana: 'こーと',
      englishLabel: 'coat',
      illustrationId: 'coat',
    },
  ],
  soku: [
    {
      id: 'sneakers',
      counterId: 'soku',
      script: '靴',
      kana: 'くつ',
      englishLabel: 'pair of shoes',
      illustrationId: 'sneakers',
    },
    {
      id: 'socks',
      counterId: 'soku',
      script: '靴下',
      kana: 'くつした',
      englishLabel: 'pair of socks',
      illustrationId: 'socks',
    },
    {
      id: 'boots',
      counterId: 'soku',
      script: 'ブーツ',
      kana: 'ぶーつ',
      englishLabel: 'pair of boots',
      illustrationId: 'boots',
    },
  ],
  wa: [
    {
      id: 'bird',
      counterId: 'wa',
      script: '鳥',
      kana: 'とり',
      englishLabel: 'bird',
      illustrationId: 'bird',
    },
    {
      id: 'rabbit',
      counterId: 'wa',
      script: 'うさぎ',
      kana: 'うさぎ',
      englishLabel: 'rabbit',
      illustrationId: 'rabbit',
    },
    {
      id: 'chicken',
      counterId: 'wa',
      script: '鶏',
      kana: 'にわとり',
      englishLabel: 'chicken',
      illustrationId: 'chicken',
    },
  ],
  kai: [
    {
      id: 'apartment-floor',
      counterId: 'kai',
      script: 'アパート',
      kana: 'あぱーと',
      englishLabel: 'apartment floor',
      illustrationId: 'apartment-building',
      particle: 'の',
    },
    {
      id: 'hotel-floor',
      counterId: 'kai',
      script: 'ホテル',
      kana: 'ほてる',
      englishLabel: 'hotel floor',
      illustrationId: 'hotel-building',
      particle: 'の',
    },
    {
      id: 'department-floor',
      counterId: 'kai',
      script: 'デパート',
      kana: 'でぱーと',
      englishLabel: 'department store floor',
      illustrationId: 'mall-building',
      particle: 'の',
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
  satsu: [
    { value: 1, script: '一冊', kana: 'いっさつ' },
    { value: 2, script: '二冊', kana: 'にさつ' },
    { value: 3, script: '三冊', kana: 'さんさつ' },
    { value: 4, script: '四冊', kana: 'よんさつ' },
    { value: 5, script: '五冊', kana: 'ごさつ' },
    { value: 6, script: '六冊', kana: 'ろくさつ' },
    { value: 7, script: '七冊', kana: 'ななさつ' },
    { value: 8, script: '八冊', kana: 'はっさつ' },
    { value: 9, script: '九冊', kana: 'きゅうさつ' },
    { value: 10, script: '十冊', kana: 'じゅっさつ' },
  ],
  dai: [
    { value: 1, script: '一台', kana: 'いちだい' },
    { value: 2, script: '二台', kana: 'にだい' },
    { value: 3, script: '三台', kana: 'さんだい' },
    { value: 4, script: '四台', kana: 'よんだい' },
    { value: 5, script: '五台', kana: 'ごだい' },
    { value: 6, script: '六台', kana: 'ろくだい' },
    { value: 7, script: '七台', kana: 'ななだい' },
    { value: 8, script: '八台', kana: 'はちだい' },
    { value: 9, script: '九台', kana: 'きゅうだい' },
    { value: 10, script: '十台', kana: 'じゅうだい' },
  ],
  ko: [
    { value: 1, script: '一個', kana: 'いっこ' },
    { value: 2, script: '二個', kana: 'にこ' },
    { value: 3, script: '三個', kana: 'さんこ' },
    { value: 4, script: '四個', kana: 'よんこ' },
    { value: 5, script: '五個', kana: 'ごこ' },
    { value: 6, script: '六個', kana: 'ろっこ' },
    { value: 7, script: '七個', kana: 'ななこ' },
    { value: 8, script: '八個', kana: 'はっこ' },
    { value: 9, script: '九個', kana: 'きゅうこ' },
    { value: 10, script: '十個', kana: 'じゅっこ' },
  ],
  nin: [
    { value: 1, script: '一人', kana: 'ひとり' },
    { value: 2, script: '二人', kana: 'ふたり' },
    { value: 3, script: '三人', kana: 'さんにん' },
    { value: 4, script: '四人', kana: 'よにん' },
    { value: 5, script: '五人', kana: 'ごにん' },
    { value: 6, script: '六人', kana: 'ろくにん' },
    { value: 7, script: '七人', kana: 'ななにん' },
    { value: 8, script: '八人', kana: 'はちにん' },
    { value: 9, script: '九人', kana: 'きゅうにん' },
    { value: 10, script: '十人', kana: 'じゅうにん' },
  ],
  hai: [
    { value: 1, script: '一杯', kana: 'いっぱい' },
    { value: 2, script: '二杯', kana: 'にはい' },
    { value: 3, script: '三杯', kana: 'さんばい' },
    { value: 4, script: '四杯', kana: 'よんはい' },
    { value: 5, script: '五杯', kana: 'ごはい' },
    { value: 6, script: '六杯', kana: 'ろっぱい' },
    { value: 7, script: '七杯', kana: 'ななはい' },
    { value: 8, script: '八杯', kana: 'はっぱい' },
    { value: 9, script: '九杯', kana: 'きゅうはい' },
    { value: 10, script: '十杯', kana: 'じゅっぱい' },
  ],
  chaku: [
    { value: 1, script: '一着', kana: 'いっちゃく' },
    { value: 2, script: '二着', kana: 'にちゃく' },
    { value: 3, script: '三着', kana: 'さんちゃく' },
    { value: 4, script: '四着', kana: 'よんちゃく' },
    { value: 5, script: '五着', kana: 'ごちゃく' },
    { value: 6, script: '六着', kana: 'ろくちゃく' },
    { value: 7, script: '七着', kana: 'ななちゃく' },
    { value: 8, script: '八着', kana: 'はっちゃく' },
    { value: 9, script: '九着', kana: 'きゅうちゃく' },
    { value: 10, script: '十着', kana: 'じゅっちゃく' },
  ],
  soku: [
    { value: 1, script: '一足', kana: 'いっそく' },
    { value: 2, script: '二足', kana: 'にそく' },
    { value: 3, script: '三足', kana: 'さんぞく' },
    { value: 4, script: '四足', kana: 'よんそく' },
    { value: 5, script: '五足', kana: 'ごそく' },
    { value: 6, script: '六足', kana: 'ろくそく' },
    { value: 7, script: '七足', kana: 'ななそく' },
    { value: 8, script: '八足', kana: 'はっそく' },
    { value: 9, script: '九足', kana: 'きゅうそく' },
    { value: 10, script: '十足', kana: 'じゅっそく' },
  ],
  wa: [
    { value: 1, script: '一羽', kana: 'いちわ' },
    { value: 2, script: '二羽', kana: 'にわ' },
    { value: 3, script: '三羽', kana: 'さんば' },
    { value: 4, script: '四羽', kana: 'よんわ' },
    { value: 5, script: '五羽', kana: 'ごわ' },
    { value: 6, script: '六羽', kana: 'ろくわ' },
    { value: 7, script: '七羽', kana: 'ななわ' },
    { value: 8, script: '八羽', kana: 'はちわ' },
    { value: 9, script: '九羽', kana: 'きゅうわ' },
    { value: 10, script: '十羽', kana: 'じゅうわ' },
  ],
  kai: [
    { value: 1, script: '一階', kana: 'いっかい' },
    { value: 2, script: '二階', kana: 'にかい' },
    { value: 3, script: '三階', kana: 'さんがい' },
    { value: 4, script: '四階', kana: 'よんかい' },
    { value: 5, script: '五階', kana: 'ごかい' },
    { value: 6, script: '六階', kana: 'ろっかい' },
    { value: 7, script: '七階', kana: 'ななかい' },
    { value: 8, script: '八階', kana: 'はっかい' },
    { value: 9, script: '九階', kana: 'きゅうかい' },
    { value: 10, script: '十階', kana: 'じゅっかい' },
  ],
};

export const COUNTER_POOL: CounterOption[] = COUNTER_OPTIONS;
export const DEFAULT_COUNTER_IDS: CounterId[] = ['hon'];
const RECENT_OBJECT_EXCLUSION_LIMIT = 10;

function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function buildObjectHistoryKey(counterId: CounterId, objectId: string): string {
  return `${counterId}:${objectId}`;
}

function isCounterId(value: string): value is CounterId {
  return COUNTER_ID_SET.has(value as CounterId);
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
  selectedCounterIds: readonly CounterId[],
  recentObjectKeys: readonly string[] = []
): CounterPracticeCard {
  const safeCounterIds =
    selectedCounterIds.length > 0 ? [...selectedCounterIds] : [...DEFAULT_COUNTER_IDS];
  const totalObjectCount = safeCounterIds.reduce(
    (count, counterId) => count + COUNTER_OBJECTS[counterId].length,
    0
  );
  const recentWindowSize =
    totalObjectCount > 1
      ? Math.min(RECENT_OBJECT_EXCLUSION_LIMIT, totalObjectCount - 1, recentObjectKeys.length)
      : 0;
  const excludedObjectKeys = new Set(recentObjectKeys.slice(0, recentWindowSize));

  const selectableCounterIds = safeCounterIds.filter((counterId) =>
    COUNTER_OBJECTS[counterId].some(
      (object) => !excludedObjectKeys.has(buildObjectHistoryKey(counterId, object.id))
    )
  );
  const counterId =
    selectableCounterIds.length > 0 ? randomItem(selectableCounterIds) : randomItem(safeCounterIds);
  const counter = COUNTER_OPTIONS_BY_ID[counterId];
  const eligibleObjects = COUNTER_OBJECTS[counterId].filter(
    (object) => !excludedObjectKeys.has(buildObjectHistoryKey(counterId, object.id))
  );
  const object =
    eligibleObjects.length > 0
      ? randomItem(eligibleObjects)
      : randomItem(COUNTER_OBJECTS[counterId]);
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
    particle: object.particle ?? 'を',
    object,
  };
}

export function buildCounterPhraseCatalog(): CounterPhraseCatalogEntry[] {
  const entries: CounterPhraseCatalogEntry[] = [];

  (Object.keys(COUNTER_OBJECTS) as CounterId[]).forEach((counterId) => {
    const objects = COUNTER_OBJECTS[counterId];
    const readings = COUNTER_READINGS[counterId];

    objects.forEach((object) => {
      const particle = object.particle ?? 'を';
      readings.forEach((reading) => {
        entries.push({
          id: `${counterId}_${object.id}_${String(reading.value).padStart(2, '0')}`,
          counterId,
          objectId: object.id,
          quantity: reading.value,
          text: `${object.script}${particle}${reading.script}`,
          kanaText: `${object.kana} ${particle} ${reading.kana}`,
          relativePath: `phrase/${counterId}/${object.id}/${String(reading.value).padStart(2, '0')}.mp3`,
        });
      });
    });
  });

  return entries;
}
