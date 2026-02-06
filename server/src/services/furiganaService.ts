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

    // kuroshiro returns HTML ruby tags like <ruby>予定<rt>よてい</rt></ruby>
    // Convert to bracket notation: 予定[よてい]
    const bracketNotation = result
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
