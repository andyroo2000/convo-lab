export const waitingPhrases = [
  {
    japanese: '少し待ってくださいね。',
    english: 'Just a moment, please.',
  },
  {
    japanese: 'ちょっと待ってくださいね。',
    english: 'Give me a moment, please.',
  },
  {
    japanese: '少しお待ちくださいね。',
    english: 'Please wait a moment.',
  },
  {
    japanese: '少し考えさせてくださいね。',
    english: 'Let me think for a moment.',
  },
  {
    japanese: 'ちょっと考えますね。',
    english: 'Let me think for a second.',
  },
  {
    japanese: '少し時間をくださいね。',
    english: 'Please give me a little time.',
  },
  {
    japanese: 'ちょっと見てみますね。',
    english: 'Let me take a look.',
  },
  {
    japanese: '少し読ませてくださいね。',
    english: 'Let me read through it for a moment.',
  },
] as const;

export function shuffled<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

let previousPhrase = -1;
export function nextWaitingPhrase() {
  const choices = waitingPhrases.filter((_, index) => index !== previousPhrase);
  const phrase = choices[Math.floor(Math.random() * choices.length)];
  previousPhrase = waitingPhrases.indexOf(phrase);
  return phrase;
}
