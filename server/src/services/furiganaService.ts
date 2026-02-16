import Kuroshiro from 'kuroshiro';
import KuromojiAnalyzer from 'kuroshiro-analyzer-kuromoji';

let kuroshiroInstance: Kuroshiro | null = null;

/**
 * Initialize kuroshiro with kuromoji analyzer (lazy initialization)
 */
async function initKuroshiro(): Promise<Kuroshiro> {
  if (!kuroshiroInstance) {
    kuroshiroInstance = new Kuroshiro();
    await kuroshiroInstance.init(new KuromojiAnalyzer());
    // eslint-disable-next-line no-console
    console.log('[Furigana] Kuroshiro initialized');
  }
  return kuroshiroInstance;
}

/**
 * Check if a character is hiragana
 */
function isHiragana(char: string): boolean {
  if (!char) return false;
  const code = char.charCodeAt(0);
  return code >= 0x3040 && code <= 0x309f;
}

/**
 * Check if a character is katakana
 */
function isKatakana(char: string): boolean {
  if (!char) return false;
  const code = char.charCodeAt(0);
  return code >= 0x30a0 && code <= 0x30ff;
}

/**
 * Check if a character is kana (hiragana or katakana)
 */
function isKana(char: string): boolean {
  return isHiragana(char) || isKatakana(char);
}

/**
 * Fix ruby elements that incorrectly include kana (hiragana/katakana) before/after kanji
 * Input: <ruby>ホテルに泊<rt>と</rt></ruby> or <ruby>が東京の<rt>とうきょう</rt></ruby>
 * Output: ホテルに<ruby>泊<rt>と</rt></ruby> or が<ruby>東京<rt>とうきょう</rt></ruby>の
 *
 * Also handles okurigana: <ruby>食べる<rt>たべる</rt></ruby> -> <ruby>食<rt>た</rt></ruby>べる
 */
function fixRubyElements(html: string): string {
  return html.replace(/<ruby>([^<]+)<rt>([^<]+)<\/rt><\/ruby>/g, (match, base, reading) => {
    // Find where the kanji starts (skip any leading kana - hiragana/katakana)
    let kanjiStart = 0;
    while (kanjiStart < base.length && isKana(base[kanjiStart])) {
      kanjiStart++;
    }

    // Find where the kanji ends (skip any trailing kana - okurigana)
    let kanjiEnd = base.length;
    while (kanjiEnd > kanjiStart && isKana(base[kanjiEnd - 1])) {
      kanjiEnd--;
    }

    // If no kanji found, return original (all katakana/hiragana text)
    if (kanjiStart >= base.length || kanjiStart >= kanjiEnd) {
      return match;
    }

    // Extract prefix, kanji, and suffix
    const prefix = base.substring(0, kanjiStart);
    const kanjiPart = base.substring(kanjiStart, kanjiEnd);
    const suffix = base.substring(kanjiEnd);

    // For okurigana, adjust the reading to only cover the kanji
    // If there's a suffix, try to remove matching suffix from reading
    let adjustedReading = reading;
    if (suffix && reading.endsWith(suffix)) {
      adjustedReading = reading.substring(0, reading.length - suffix.length);
    }

    // Return: prefix + <ruby>kanji<rt>reading</rt></ruby> + suffix
    return prefix + `<ruby>${kanjiPart}<rt>${adjustedReading}</rt></ruby>` + suffix;
  });
}

/**
 * Convert Japanese text to bracket notation with furigana
 * Input: "予定があるんです"
 * Output: "予定[よてい]があるんです"
 */
export async function addFuriganaBrackets(text: string): Promise<string> {
  try {
    const kuroshiro = await initKuroshiro();

    // Convert to furigana, but only for kanji
    const result = await kuroshiro.convert(text, {
      to: 'hiragana',
      mode: 'furigana',
      romajiSystem: 'passport',
    });

    // Fix ruby elements that incorrectly include hiragana prefixes
    const fixedResult = fixRubyElements(result);

    // kuroshiro returns HTML ruby tags like <ruby>予定<rt>よてい</rt></ruby>
    // Convert to bracket notation: 予定[よてい]
    const bracketNotation = fixedResult
      .replace(/<ruby>([^<]+)<rt>([^<]+)<\/rt><\/ruby>/g, '$1[$2]')
      .replace(/<\/?[^>]+(>|$)/g, ''); // Remove any remaining HTML tags

    return bracketNotation;
  } catch (error) {
    console.error('[Furigana] Error adding furigana:', error);
    // Return original text if furigana generation fails
    return text;
  }
}

/**
 * Add reading notation (furigana) based on language
 */
export async function addReadingBrackets(text: string, language: string): Promise<string> {
  if (language === 'ja') {
    return addFuriganaBrackets(text);
  }
  // For other languages, return original text
  return text;
}
