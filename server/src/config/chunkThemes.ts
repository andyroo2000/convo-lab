/**
 * Lexical Chunk Pack Themes and Configuration
 *
 * Defines themes for each JLPT level with example chunks and guidance.
 */

export type JLPTLevel = 'N5' | 'N4' | 'N3';

export type ChunkPackTheme =
  // N5 Themes
  | 'daily_routine'
  | 'greetings'
  | 'shopping'
  | 'family'
  | 'school'
  | 'food'
  | 'weather'
  | 'hobbies'
  // N4 Themes
  | 'health'
  | 'travel'
  | 'opinions'
  | 'plans'
  | 'feelings'
  | 'requests'
  | 'advice'
  | 'experiences'
  // N3 Themes
  | 'work'
  | 'social_life'
  | 'habits'
  | 'expectations'
  | 'comparisons'
  | 'reasoning'
  | 'preferences'
  | 'goals';

export interface ThemeMetadata {
  id: ChunkPackTheme;
  name: string;
  level: JLPTLevel;
  description: string;
  exampleChunks: string[]; // Example chunks for this theme
  usageContext: string; // When/where learners would use these chunks
}

export const CHUNK_THEMES: Record<ChunkPackTheme, ThemeMetadata> = {
  // ===== N5 THEMES =====
  daily_routine: {
    id: 'daily_routine',
    name: 'Daily Routine',
    level: 'N5',
    description: 'Essential expressions for describing daily activities',
    exampleChunks: [
      '〜てください (please do ~)',
      "〜ましょう (let's ~)",
      '〜ています (doing ~)',
      '〜から (because ~)',
      '〜まえに (before ~)',
      '〜あとで (after ~)',
      '〜てから (after doing ~)',
    ],
    usageContext: 'Talking about your day, making plans, explaining routines',
  },
  greetings: {
    id: 'greetings',
    name: 'Greetings & Politeness',
    level: 'N5',
    description: 'Common fixed expressions for social interactions',
    exampleChunks: [
      'お疲れ様です (good work / hello)',
      'よろしくお願いします (please treat me well)',
      "いただきます (let's eat)",
      'ごちそうさまでした (thank you for the meal)',
      'すみません (excuse me / sorry)',
      'ありがとうございます (thank you)',
    ],
    usageContext: 'Meeting people, meals, workplace greetings, showing respect',
  },
  shopping: {
    id: 'shopping',
    name: 'Shopping',
    level: 'N5',
    description: 'Phrases for buying things and asking about products',
    exampleChunks: [
      '〜をください (please give me ~)',
      'いくらですか (how much is it?)',
      '〜でいいです (~ is fine)',
      '〜はありますか (do you have ~?)',
      '〜が欲しいです (I want ~)',
      "〜を探しています (I'm looking for ~)",
    ],
    usageContext: 'Shopping, restaurants, convenience stores',
  },
  family: {
    id: 'family',
    name: 'Family',
    level: 'N5',
    description: 'Talking about family members and relationships',
    exampleChunks: [
      '〜がいます (have ~ / there is ~)',
      '〜と住んでいます (living with ~)',
      '〜は〜歳です (~ is X years old)',
      '〜人家族です (~ person family)',
      '〜と呼びます (call ~ / named ~)',
    ],
    usageContext: 'Introducing family, describing household, talking about relatives',
  },
  school: {
    id: 'school',
    name: 'School',
    level: 'N5',
    description: 'Education-related expressions',
    exampleChunks: [
      '〜を勉強します (study ~)',
      '〜のクラス (~ class)',
      '〜が好きです (like ~)',
      '〜が得意です (good at ~)',
      '〜が苦手です (bad at ~)',
      '〜を習います (learn ~)',
    ],
    usageContext: 'Talking about classes, subjects, school life',
  },
  food: {
    id: 'food',
    name: 'Food & Eating',
    level: 'N5',
    description: 'Expressions for meals and food preferences',
    exampleChunks: [
      '〜が食べたい (want to eat ~)',
      '〜を作ります (make ~)',
      '〜が美味しい (~ is delicious)',
      '〜が好き (like ~)',
      '〜が嫌い (dislike ~)',
      '〜を注文します (order ~)',
    ],
    usageContext: 'Restaurants, cooking, discussing food preferences',
  },
  weather: {
    id: 'weather',
    name: 'Weather',
    level: 'N5',
    description: 'Talking about weather and seasons',
    exampleChunks: [
      '〜そうです (looks like ~ / I heard ~)',
      '〜になります (become ~)',
      '〜でした (was ~)',
      '〜みたいです (seems like ~)',
      '〜と思います (I think ~)',
    ],
    usageContext: 'Small talk, planning activities, describing conditions',
  },
  hobbies: {
    id: 'hobbies',
    name: 'Hobbies & Interests',
    level: 'N5',
    description: 'Talking about leisure activities',
    exampleChunks: [
      '〜のが好き (like doing ~)',
      '〜をしています (do ~ / doing ~)',
      '〜に行きます (go to ~)',
      '〜を見ます (watch ~)',
      '〜を聞きます (listen to ~)',
      '〜が趣味です (~ is my hobby)',
    ],
    usageContext: 'Getting to know people, self-introduction, free time activities',
  },

  // ===== N4 THEMES =====
  health: {
    id: 'health',
    name: 'Health & Body',
    level: 'N4',
    description: 'Medical situations and health advice',
    exampleChunks: [
      '〜てしまいました (ended up ~ing / regrettably)',
      '〜なければならない (must ~)',
      '〜たほうがいい (had better ~)',
      '〜てみます (try ~ing)',
      '〜ないといけない (must ~)',
      '〜てはいけません (must not ~)',
    ],
    usageContext: 'Doctor visits, giving/receiving advice, describing symptoms',
  },
  travel: {
    id: 'travel',
    name: 'Travel',
    level: 'N4',
    description: 'Planning trips and navigating places',
    exampleChunks: [
      '〜ておきます (do ~ in advance)',
      '〜てみたい (want to try ~)',
      '〜ことがあります (have done ~ before)',
      '〜予定です (plan to ~)',
      '〜つもりです (intend to ~)',
      '〜た方がいい (should ~)',
    ],
    usageContext: 'Planning travel, asking for directions, booking accommodations',
  },
  opinions: {
    id: 'opinions',
    name: 'Opinions',
    level: 'N4',
    description: 'Expressing thoughts and uncertainty',
    exampleChunks: [
      '〜と思います (I think ~)',
      '〜かもしれません (might ~)',
      '〜らしいです (seems ~ / I heard ~)',
      '〜みたいです (looks like ~)',
      '〜そうです (looks ~ / I heard ~)',
      '〜はずです (should ~)',
    ],
    usageContext: 'Discussions, sharing views, hedging statements',
  },
  plans: {
    id: 'plans',
    name: 'Plans & Intentions',
    level: 'N4',
    description: 'Talking about future intentions and decisions',
    exampleChunks: [
      '〜つもりです (intend to ~)',
      '〜ことにしました (decided to ~)',
      '〜予定です (plan to ~)',
      '〜ようと思います (thinking of ~ing)',
      '〜たいと思います (want to ~ / thinking of ~ing)',
    ],
    usageContext: 'Making plans, announcing decisions, discussing goals',
  },
  feelings: {
    id: 'feelings',
    name: 'Feelings & Emotions',
    level: 'N4',
    description: 'Expressing emotional states',
    exampleChunks: [
      '〜てうれしい (happy that ~)',
      '〜て悲しい (sad that ~)',
      '〜て心配 (worried that ~)',
      '〜てびっくり (surprised that ~)',
      '〜て嬉しかった (was happy that ~)',
      '〜て残念 (disappointed that ~)',
    ],
    usageContext: 'Sharing feelings, reacting to news, empathizing',
  },
  requests: {
    id: 'requests',
    name: 'Requests & Permissions',
    level: 'N4',
    description: 'Politely asking for things',
    exampleChunks: [
      '〜ていただけますか (could you ~ for me?)',
      '〜てくれませんか (would you ~ for me?)',
      '〜てもいいですか (may I ~?)',
      '〜てもらえますか (could I get you to ~?)',
      '〜させてください (please let me ~)',
    ],
    usageContext: 'Workplace, asking favors, seeking permission',
  },
  advice: {
    id: 'advice',
    name: 'Advice & Suggestions',
    level: 'N4',
    description: 'Giving and receiving recommendations',
    exampleChunks: [
      '〜ほうがいい (should ~)',
      '〜ないほうがいい (should not ~)',
      '〜たら (if/when ~)',
      '〜なら (if ~)',
      '〜たほうがいいですよ (you should ~)',
    ],
    usageContext: 'Helping friends, consulting, problem-solving',
  },
  experiences: {
    id: 'experiences',
    name: 'Experiences',
    level: 'N4',
    description: "Talking about what you've done",
    exampleChunks: [
      '〜たことがある (have done ~)',
      '〜てみた (tried ~ing)',
      '〜ていた (was ~ing / used to ~)',
      '〜たばかり (just did ~)',
      '〜てから (since ~ing)',
    ],
    usageContext: 'Sharing stories, comparing experiences, connecting with others',
  },

  // ===== N3 THEMES =====
  work: {
    id: 'work',
    name: 'Work & Professional',
    level: 'N3',
    description: 'Workplace language and professional situations',
    exampleChunks: [
      '〜ようにする (make sure to ~)',
      '〜ことにしている (have decided to ~ / make it a rule to ~)',
      '〜わけにはいかない (cannot reasonably ~)',
      '〜べきだ (should ~)',
      '〜ざるを得ない (have no choice but to ~)',
      'お世話になっております (thank you for your support)',
    ],
    usageContext: 'Office, meetings, business emails, professional relationships',
  },
  social_life: {
    id: 'social_life',
    name: 'Social Life',
    level: 'N3',
    description: 'Social expectations and relationships',
    exampleChunks: [
      "〜ことになっている (it's decided / expected that ~)",
      '〜みたいだ (seems like ~)',
      '〜ようだ (appears ~)',
      '〜らしい (I heard ~)',
      "〜わけではない (it doesn't mean ~)",
    ],
    usageContext: 'Navigating social rules, interpreting situations, gossip',
  },
  habits: {
    id: 'habits',
    name: 'Habits & Routines',
    level: 'N3',
    description: 'Describing regular behaviors',
    exampleChunks: [
      '〜ことにしている (make it a rule to ~)',
      '〜ようにしている (try to ~)',
      '〜たものだ (used to ~)',
      '〜がちだ (tend to ~)',
      "〜ものだ (should ~ / it's natural to ~)",
    ],
    usageContext: 'Self-improvement, explaining behavior, lifestyle discussions',
  },
  expectations: {
    id: 'expectations',
    name: 'Expectations',
    level: 'N3',
    description: 'What should or will happen',
    exampleChunks: [
      '〜はずだ (should ~)',
      '〜に違いない (must be ~)',
      '〜わけだ (no wonder ~)',
      '〜べきだ (ought to ~)',
      '〜ものだ (one should ~)',
    ],
    usageContext: 'Making predictions, expressing conviction, reasoning',
  },
  comparisons: {
    id: 'comparisons',
    name: 'Comparisons',
    level: 'N3',
    description: 'Contrasting and comparing things',
    exampleChunks: [
      '〜より (than ~)',
      '〜ほど (as ~ as / to the extent)',
      '〜にしては (for ~ / considering ~)',
      '〜に比べて (compared to ~)',
      '〜というより (rather than ~)',
    ],
    usageContext: 'Evaluating options, nuanced descriptions, contrasts',
  },
  reasoning: {
    id: 'reasoning',
    name: 'Reasoning',
    level: 'N3',
    description: 'Explaining causes and reasons',
    exampleChunks: [
      "〜わけではない (it's not that ~)",
      "〜というわけだ (that's why ~)",
      '〜せいで (because of ~ / blame)',
      '〜おかげで (thanks to ~)',
      '〜ため (because of ~)',
    ],
    usageContext: 'Justifying, explaining outcomes, clarifying misunderstandings',
  },
  preferences: {
    id: 'preferences',
    name: 'Preferences',
    level: 'N3',
    description: 'Expressing likes and choices',
    exampleChunks: [
      '〜というより (rather than ~)',
      '〜ほうがいい (prefer ~)',
      "〜くらいなら (rather than ~ / if it's like ~)",
      '〜ばかりでなく (not only ~ but also)',
      '〜というか (or rather ~)',
    ],
    usageContext: 'Making choices, expressing subtle preferences',
  },
  goals: {
    id: 'goals',
    name: 'Goals & Purposes',
    level: 'N3',
    description: 'Expressing aims and objectives',
    exampleChunks: [
      '〜ように (so that ~)',
      '〜ために (in order to ~)',
      '〜べく (in order to ~ [formal])',
      '〜つもりで (with the intention of ~)',
      '〜ようと (trying to ~)',
    ],
    usageContext: 'Explaining motivations, setting goals, purposeful actions',
  },
};

// Helper function to get themes for a specific JLPT level
export function getThemesForLevel(level: JLPTLevel): ThemeMetadata[] {
  return Object.values(CHUNK_THEMES).filter((theme) => theme.level === level);
}

// Helper function to get theme metadata
export function getThemeMetadata(themeId: ChunkPackTheme): ThemeMetadata {
  return CHUNK_THEMES[themeId];
}
