/**
 * Common names for dialogue speakers by language and gender
 * Japanese names include furigana in bracket notation
 * Chinese names include pinyin in bracket notation
 * Spanish names are plain text (Spanish is phonetic)
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
  zh: {
    female: [
      '王[wáng]美[měi]',
      '李[lǐ]娜[nà]',
      '张[zhāng]静[jìng]',
      '刘[liú]芳[fāng]',
      '陈[chén]丽[lì]',
      '杨[yáng]敏[mǐn]',
      '黄[huáng]婷[tíng]',
      '赵[zhào]雪[xuě]',
      '周[zhōu]梅[méi]',
      '吴[wú]玲[líng]',
    ],
    male: [
      '王[wáng]伟[wěi]',
      '李[lǐ]强[qiáng]',
      '张[zhāng]军[jūn]',
      '刘[liú]杰[jié]',
      '陈[chén]涛[tāo]',
      '杨[yáng]磊[lěi]',
      '黄[huáng]鹏[péng]',
      '赵[zhào]勇[yǒng]',
      '周[zhōu]明[míng]',
      '吴[wú]刚[gāng]',
    ],
  },
  es: {
    female: [
      'María',
      'Carmen',
      'Isabel',
      'Ana',
      'Lucía',
      'Elena',
      'Rosa',
      'Paula',
      'Sara',
      'Laura',
    ],
    male: [
      'Carlos',
      'Antonio',
      'José',
      'Juan',
      'Manuel',
      'Francisco',
      'Luis',
      'Miguel',
      'Pedro',
      'Rafael',
    ],
  },
  fr: {
    female: [
      'Sophie',
      'Camille',
      'Léa',
      'Amina',
      'Marie',
      'Yasmine',
      'Chloé',
      'Fatima',
      'Julie',
      'Nadia',
    ],
    male: [
      'Thomas',
      'Lucas',
      'Mathieu',
      'Karim',
      'Pierre',
      'Malik',
      'Antoine',
      'Youssef',
      'Alexandre',
      'Omar',
    ],
  },
} as const;

export type LanguageCode = 'ja' | 'zh' | 'es' | 'fr';
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
