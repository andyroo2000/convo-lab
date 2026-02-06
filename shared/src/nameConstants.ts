/**
 * Common names for dialogue speakers by language and gender
 * Japanese names include furigana in bracket notation
 */

export const SPEAKER_NAMES = {
  ja: {
    female: [
      '田中[たなか]さくら',
      '佐藤[さとう]美咲[みさき]',
      '鈴木[すずき]愛[あい]',
      '高橋[たかはし]結衣[ゆい]',
      '伊藤[いとう]陽菜[ひな]',
      '渡辺[わたなべ]七海[ななみ]',
      '山本[やまもと]花[はな]',
      '中村[なかむら]優[ゆう]',
      '小林[こばやし]葵[あおい]',
      '加藤[かとう]莉子[りこ]',
    ],
    male: [
      '田中[たなか]健二[けんじ]',
      '佐藤[さとう]大輝[だいき]',
      '鈴木[すずき]翔太[しょうた]',
      '高橋[たかはし]蓮[れん]',
      '伊藤[いとう]悠斗[ゆうと]',
      '渡辺[わたなべ]陸[りく]',
      '山本[やまもと]颯[はやて]',
      '中村[なかむら]樹[いつき]',
      '小林[こばやし]湊[みなと]',
      '加藤[かとう]拓海[たくみ]',
    ],
  },
  en: {
    female: [
      'Emily',
      'Sarah',
      'Jessica',
      'Emma',
      'Jennifer',
      'Ashley',
      'Amanda',
      'Melissa',
      'Stephanie',
      'Rachel',
    ],
    male: [
      'Michael',
      'James',
      'Robert',
      'John',
      'David',
      'William',
      'Christopher',
      'Matthew',
      'Daniel',
      'Andrew',
    ],
  },
} as const;

export type LanguageCode = 'ja' | 'en';
export type Gender = 'male' | 'female';

/**
 * Get a random name for the specified language and gender
 */
export function getRandomName(language: LanguageCode, gender: Gender): string {
  const names = SPEAKER_NAMES[language]?.[gender];
  if (!names) {
    return gender === 'female' ? 'Speaker F' : 'Speaker M';
  }
  return names[Math.floor(Math.random() * names.length)];
}
