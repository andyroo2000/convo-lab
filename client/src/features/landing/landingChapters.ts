const landingChapters = [
  {
    title: 'I tried journaling to improve my Japanese.',
    body: 'I started by writing into a chatbot. The feedback was useful, but the experience wasn’t something I looked forward to. So I made a place where I’d want to keep practicing.',
    film: 'particle',
    description: 'A Japanese particle correction, with its explanation and corrected entry.',
  },
  {
    title: 'Just checking!',
    body: 'When a sentence is unclear, the tutor asks before correcting it.',
    film: 'clarification',
    description:
      'Writing a draft, answering a tutor’s question, reviewing the correction, and listening to the final entry.',
  },
  {
    title: 'Love WaniKani? We do too.',
    body: 'Connect WaniKani to show furigana only on words with kanji you haven’t learned. Or turn it on for every word.',
    film: 'wanikani',
    description:
      'Connecting WaniKani in settings and reading a journal entry with personalized furigana.',
  },
  {
    title: 'Pick up where you left off.',
    body: 'Write, review, listen, and shadow on web, iOS, and Android. Start on one and continue on another.',
    film: 'platforms-icons-blue',
    description: 'Continuing the same Japanese journal entry in a browser, on iOS, and on Android.',
  },
] as const;

export default landingChapters;
