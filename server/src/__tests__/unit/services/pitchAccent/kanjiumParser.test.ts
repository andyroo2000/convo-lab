import { describe, expect, it } from 'vitest';

import {
  indexKanjiumRows,
  parseKanjiumAccentLine,
  parseKanjiumAccentText,
} from '../../../../services/pitchAccent/kanjiumParser.js';

describe('kanjiumParser', () => {
  it('parses tab-separated Kanjium rows with comma-separated pitch numbers', () => {
    expect(parseKanjiumAccentLine('上手\tじょうず\t3,0')).toEqual({
      surface: '上手',
      reading: 'じょうず',
      pitchNums: [3, 0],
    });
  });

  it('skips malformed rows and non-numeric pitch values', () => {
    expect(parseKanjiumAccentLine('上手\tじょうず')).toBeNull();
    expect(parseKanjiumAccentLine('上手\tじょうず\tbad')).toBeNull();
    expect(parseKanjiumAccentLine('# comment')).toBeNull();
    expect(parseKanjiumAccentText('会社\tかいしゃ\t0\nbad row\n学校\tがっこう\t0')).toHaveLength(2);
  });

  it('indexes duplicate surfaces and readings without dropping variants', () => {
    const index = indexKanjiumRows(
      parseKanjiumAccentText('上手\tじょうず\t3\n上手\tうわて\t0\n上手\tじょうず\t0')
    );

    expect(index.get('上手')).toEqual([
      { surface: '上手', reading: 'じょうず', pitchNum: 3 },
      { surface: '上手', reading: 'うわて', pitchNum: 0 },
      { surface: '上手', reading: 'じょうず', pitchNum: 0 },
    ]);
  });
});
