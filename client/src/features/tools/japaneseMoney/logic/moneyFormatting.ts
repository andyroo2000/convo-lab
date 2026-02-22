const DIGIT_READINGS = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'] as const;
const UNIT_SCRIPT = ['', '万', '億', '兆'] as const;
const UNIT_KANA = ['', 'まん', 'おく', 'ちょう'] as const;

export interface MoneyReadingSegment {
  digits: string;
  digitsReading: string;
  unitScript: '' | '万' | '億' | '兆';
  unitKana: '' | 'まん' | 'おく' | 'ちょう';
}

export interface MoneyReading {
  segments: MoneyReadingSegment[];
  kana: string;
}

const sanitizeAmount = (amount: number): number => {
  if (!Number.isFinite(amount)) {
    return 0;
  }

  return Math.max(0, Math.trunc(amount));
};

function readUnder10000(value: number): string {
  const safe = Math.trunc(value);

  if (safe === 0) {
    return 'れい';
  }

  let remaining = safe;
  const parts: string[] = [];

  const thousands = Math.floor(remaining / 1000);
  if (thousands > 0) {
    if (thousands === 1) {
      parts.push('せん');
    } else if (thousands === 3) {
      parts.push('さんぜん');
    } else if (thousands === 8) {
      parts.push('はっせん');
    } else {
      parts.push(`${DIGIT_READINGS[thousands]}せん`);
    }

    remaining %= 1000;
  }

  const hundreds = Math.floor(remaining / 100);
  if (hundreds > 0) {
    if (hundreds === 1) {
      parts.push('ひゃく');
    } else if (hundreds === 3) {
      parts.push('さんびゃく');
    } else if (hundreds === 6) {
      parts.push('ろっぴゃく');
    } else if (hundreds === 8) {
      parts.push('はっぴゃく');
    } else {
      parts.push(`${DIGIT_READINGS[hundreds]}ひゃく`);
    }

    remaining %= 100;
  }

  const tens = Math.floor(remaining / 10);
  if (tens > 0) {
    if (tens === 1) {
      parts.push('じゅう');
    } else {
      parts.push(`${DIGIT_READINGS[tens]}じゅう`);
    }

    remaining %= 10;
  }

  if (remaining > 0) {
    parts.push(DIGIT_READINGS[remaining]);
  }

  return parts.join('');
}

export function formatYenAmount(amount: number): string {
  const normalizedAmount = sanitizeAmount(amount);
  return `¥${new Intl.NumberFormat('ja-JP').format(normalizedAmount)}`;
}

export function formatReceiptTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

export function buildMoneyReading(amount: number): MoneyReading {
  const safeAmount = sanitizeAmount(amount);

  if (safeAmount === 0) {
    return {
      segments: [
        {
          digits: '0',
          digitsReading: 'れい',
          unitScript: '',
          unitKana: '',
        },
      ],
      kana: 'れいえん',
    };
  }

  const chunks: number[] = [];
  let remaining = safeAmount;

  while (remaining > 0) {
    chunks.push(remaining % 10000);
    remaining = Math.floor(remaining / 10000);
  }

  const segments: MoneyReadingSegment[] = [];

  for (let index = chunks.length - 1; index >= 0; index -= 1) {
    const chunk = chunks[index];
    if (chunk === 0) {
      continue;
    }

    const unitScript = UNIT_SCRIPT[index] ?? '';
    const unitKana = UNIT_KANA[index] ?? '';

    segments.push({
      digits: String(chunk),
      digitsReading: readUnder10000(chunk),
      unitScript,
      unitKana,
    });
  }

  const kana = `${segments
    .map((segment) => `${segment.digitsReading}${segment.unitKana}`)
    .join('')}えん`;

  return {
    segments,
    kana,
  };
}
