export type JapaneseHourFormat = '12h' | '24h';

export interface JapaneseDateTimeParts {
  yearScript: string;
  yearKana: string;
  monthScript: string;
  monthKana: string;
  dayScript: string;
  dayKana: string;
  weekdayScript: string;
  weekdayKana: string;
  periodScript: string | null;
  periodKana: string | null;
  hourScript: string;
  hourKana: string;
  minuteScript: string;
  minuteKana: string;
}

export interface JapaneseDateTimeReading {
  dateScript: string;
  dateKana: string;
  timeScript: string;
  timeKana: string;
  fullScript: string;
  fullKana: string;
  parts: JapaneseDateTimeParts;
}

interface ReadingOptions {
  hourFormat?: JapaneseHourFormat;
}

const DIGIT_READINGS = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];

const MONTH_READINGS = [
  '',
  'いちがつ',
  'にがつ',
  'さんがつ',
  'しがつ',
  'ごがつ',
  'ろくがつ',
  'しちがつ',
  'はちがつ',
  'くがつ',
  'じゅうがつ',
  'じゅういちがつ',
  'じゅうにがつ',
] as const;

const DAY_READINGS = [
  '',
  'ついたち',
  'ふつか',
  'みっか',
  'よっか',
  'いつか',
  'むいか',
  'なのか',
  'ようか',
  'ここのか',
  'とおか',
  'じゅういちにち',
  'じゅうににち',
  'じゅうさんにち',
  'じゅうよっか',
  'じゅうごにち',
  'じゅうろくにち',
  'じゅうしちにち',
  'じゅうはちにち',
  'じゅうくにち',
  'はつか',
  'にじゅういちにち',
  'にじゅうににち',
  'にじゅうさんにち',
  'にじゅうよっか',
  'にじゅうごにち',
  'にじゅうろくにち',
  'にじゅうしちにち',
  'にじゅうはちにち',
  'にじゅうくにち',
  'さんじゅうにち',
  'さんじゅういちにち',
] as const;

const WEEKDAY_SYMBOLS = ['日', '月', '火', '水', '木', '金', '土'] as const;
const WEEKDAY_READINGS = [
  'にちようび',
  'げつようび',
  'かようび',
  'すいようび',
  'もくようび',
  'きんようび',
  'どようび',
] as const;

const HOUR_READINGS_24 = [
  'れいじ',
  'いちじ',
  'にじ',
  'さんじ',
  'よじ',
  'ごじ',
  'ろくじ',
  'しちじ',
  'はちじ',
  'くじ',
  'じゅうじ',
  'じゅういちじ',
  'じゅうにじ',
  'じゅうさんじ',
  'じゅうよじ',
  'じゅうごじ',
  'じゅうろくじ',
  'じゅうしちじ',
  'じゅうはちじ',
  'じゅうくじ',
  'にじゅうじ',
  'にじゅういちじ',
  'にじゅうにじ',
  'にじゅうさんじ',
] as const;

const MINUTE_BASE_READINGS = [
  '',
  'いっぷん',
  'にふん',
  'さんぷん',
  'よんぷん',
  'ごふん',
  'ろっぷん',
  'ななふん',
  'はっぷん',
  'きゅうふん',
] as const;

function readUnder10000(value: number): string {
  const safe = Math.trunc(value);
  if (safe === 0) {
    return 'ぜろ';
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

function readNumber(value: number): string {
  const safe = Math.trunc(value);
  if (safe === 0) {
    return 'ぜろ';
  }

  const chunks: string[] = [];
  let remaining = safe;
  const units = ['', 'まん', 'おく'] as const;
  let unitIndex = 0;

  while (remaining > 0) {
    const chunk = remaining % 10000;
    if (chunk > 0) {
      const chunkReading = readUnder10000(chunk);
      const unit = units[unitIndex];
      chunks.unshift(`${chunkReading}${unit}`);
    }
    remaining = Math.floor(remaining / 10000);
    unitIndex += 1;
  }

  return chunks.join('');
}

function readYear(year: number): string {
  return `${readNumber(year)}ねん`;
}

function readMonth(month: number): string {
  const value = MONTH_READINGS[month];
  if (!value) {
    throw new Error(`Unsupported month: ${month}`);
  }
  return value;
}

function readDayOfMonth(day: number): string {
  const value = DAY_READINGS[day];
  if (!value) {
    throw new Error(`Unsupported day of month: ${day}`);
  }
  return value;
}

function readHour24(hour: number): string {
  const value = HOUR_READINGS_24[hour];
  if (!value) {
    throw new Error(`Unsupported hour: ${hour}`);
  }
  return value;
}

function readMinute(minute: number): string {
  if (minute < 0 || minute > 59) {
    throw new Error(`Unsupported minute: ${minute}`);
  }

  if (minute === 0) {
    return 'れいふん';
  }

  const tens = Math.floor(minute / 10);
  const ones = minute % 10;

  if (tens === 0) {
    return MINUTE_BASE_READINGS[ones];
  }

  const tenPrefix = tens === 1 ? 'じゅう' : `${DIGIT_READINGS[tens]}じゅう`;

  if (ones === 0) {
    return `${tenPrefix.slice(0, -1)}っぷん`;
  }

  return `${tenPrefix}${MINUTE_BASE_READINGS[ones]}`;
}

function toDateTimeParts(date: Date, hourFormat: JapaneseHourFormat): JapaneseDateTimeParts {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = date.getDay();
  const hour24 = date.getHours();
  const minute = date.getMinutes();

  const is12h = hourFormat === '12h';

  let periodScript: string | null = null;
  let periodKana: string | null = null;

  if (is12h) {
    if (hour24 < 12) {
      periodScript = '午前';
      periodKana = 'ごぜん';
    } else {
      periodScript = '午後';
      periodKana = 'ごご';
    }
  }

  const hourForDisplay = is12h ? hour24 % 12 || 12 : hour24;

  return {
    yearScript: `${year}年`,
    yearKana: readYear(year),
    monthScript: `${month}月`,
    monthKana: readMonth(month),
    dayScript: `${day}日`,
    dayKana: readDayOfMonth(day),
    weekdayScript: WEEKDAY_SYMBOLS[weekday],
    weekdayKana: WEEKDAY_READINGS[weekday],
    periodScript,
    periodKana,
    hourScript: `${hourForDisplay}時`,
    hourKana: readHour24(hourForDisplay),
    minuteScript: `${String(minute).padStart(2, '0')}分`,
    minuteKana: readMinute(minute),
  };
}

export function generateJapaneseDateTimeReading(
  date: Date,
  options: ReadingOptions = {}
): JapaneseDateTimeReading {
  const hourFormat = options.hourFormat ?? '12h';
  const parts = toDateTimeParts(date, hourFormat);

  const dateScript = `${parts.yearScript}${parts.monthScript}${parts.dayScript}（${parts.weekdayScript}）`;
  const dateKana = `${parts.yearKana} ${parts.monthKana} ${parts.dayKana} ${parts.weekdayKana}`;

  const timeScript = parts.periodScript
    ? `${parts.periodScript}${parts.hourScript}${parts.minuteScript}`
    : `${parts.hourScript}${parts.minuteScript}`;

  const timeKana = parts.periodKana
    ? `${parts.periodKana} ${parts.hourKana} ${parts.minuteKana}`
    : `${parts.hourKana} ${parts.minuteKana}`;

  return {
    dateScript,
    dateKana,
    timeScript,
    timeKana,
    fullScript: `${dateScript} ${timeScript}`,
    fullKana: `${dateKana} ${timeKana}`,
    parts,
  };
}

export function toLocalDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toLocalTimeInputValue(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function parseLocalDateTimeInput(dateValue: string, timeValue: string): Date {
  const parsed = new Date(`${dateValue}T${timeValue}`);

  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }

  return parsed;
}
