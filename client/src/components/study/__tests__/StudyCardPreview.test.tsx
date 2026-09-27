import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { StudyCardFace } from '../StudyCardPreview';
import { baseCard, mockStudyCardMedia } from './studyCardPreviewFixtures';

describe('StudyCardPreview', () => {
  beforeEach(mockStudyCardMedia);

  it('renders furigana as explicit ruby text on the answer side', () => {
    render(<StudyCardFace card={baseCard} side="back" />);

    const heading = screen.getByTestId('study-japanese-heading');
    expect(within(heading).getByText('かいしゃ', { selector: 'rt' })).toBeInTheDocument();
    expect(screen.getByText('company')).toBeInTheDocument();
  });

  it('renders the supported server presentation instead of divergent raw fields', () => {
    const card = {
      ...baseCard,
      prompt: { cueText: 'raw prompt', cueMeaning: 'raw hint' },
      answer: { expression: 'raw answer', meaning: 'raw meaning', notes: 'raw note' },
      presentation: {
        version: 1 as const,
        front: {
          mode: 'text' as const,
          text: '会社',
          ruby: '会社[かいしゃかいしゃかいしゃかいしゃかいしゃ]',
          hint: 'server hint',
          media: { audio: null, image: null },
          autoplayAudio: false,
        },
        answer: {
          heading: '企業',
          ruby: '企業[きぎょう]',
          restored: null,
          meaning: 'server meaning',
          sentences: {
            japanese: { text: '企業です', ruby: '企業[きぎょう]です' },
            english: { text: 'It is a company.', ruby: null },
          },
          notes: ['server note'],
          media: { image: { url: 'https://example.com/server-answer.webp' } },
          audio: null,
        },
      },
    };

    const { rerender } = render(<StudyCardFace card={card} side="front" />);
    const frontHeading = screen.getByTestId('study-front-heading');
    expect(
      within(frontHeading).getByText('かいしゃかいしゃかいしゃかいしゃかいしゃ', {
        selector: 'rt',
      })
    ).toBeInTheDocument();
    expect(frontHeading).toHaveClass('text-4xl');
    expect(screen.getByText('server hint')).toBeInTheDocument();
    expect(screen.queryByText('raw prompt')).not.toBeInTheDocument();

    rerender(<StudyCardFace card={card} side="back" />);
    expect(
      within(screen.getByTestId('study-japanese-heading')).getByText('きぎょう', {
        selector: 'rt',
      })
    ).toBeInTheDocument();
    expect(screen.getByText('server meaning')).toBeInTheDocument();
    expect(screen.getByText('server note')).toBeInTheDocument();
    expect(screen.getByText('It is a company.')).toBeInTheDocument();
    expect(screen.getByAltText('Answer visual')).toHaveAttribute(
      'src',
      'https://example.com/server-answer.webp'
    );
    expect(screen.queryByText('raw meaning')).not.toBeInTheDocument();
  });

  it('skips blank front ruby and trusts text mode despite a stale outer cloze type', () => {
    const card = {
      ...baseCard,
      cardType: 'cloze' as const,
      prompt: { clozeDisplayText: 'raw [...] prompt' },
      answer: {
        ...baseCard.answer,
        expression: 'raw answer',
        expressionReading: '会社[stale-reading]',
      },
      presentation: {
        version: 1 as const,
        front: {
          mode: 'text' as const,
          text: ' 会社 ',
          ruby: '   ',
          hint: null,
          media: { audio: null, image: null },
          autoplayAudio: false,
        },
        answer: {
          heading: null,
          ruby: null,
          restored: null,
          meaning: null,
          sentences: {
            japanese: { text: null, ruby: null },
            english: { text: null, ruby: null },
          },
          notes: [],
          media: { image: null },
          audio: null,
        },
      },
    };

    const { rerender } = render(<StudyCardFace card={card} side="front" />);

    expect(screen.getByText('会社')).toBeInTheDocument();
    expect(screen.queryByTestId('study-cloze-prompt')).not.toBeInTheDocument();
    expect(screen.queryByText('stale-reading', { selector: 'rt' })).not.toBeInTheDocument();

    rerender(<StudyCardFace card={card} side="back" />);
    expect(screen.queryByText('raw answer')).not.toBeInTheDocument();
    expect(
      screen.queryByText('This card only has the core answer content imported so far.')
    ).not.toBeInTheDocument();
  });

  it('skips blank cloze ruby and trusts cloze mode despite a stale outer recognition type', () => {
    const longServerHeading =
      'This authoritative server heading is deliberately longer than forty characters';
    const card = {
      ...baseCard,
      cardType: 'recognition' as const,
      prompt: { clozeText: 'これは{{c1::答え}}です' },
      answer: {
        restoredText: 'raw restored',
        restoredTextReading: '生[stale-reading]',
        meaning: 'raw meaning',
      },
      presentation: {
        version: 1 as const,
        front: {
          mode: 'cloze' as const,
          text: 'これは[...]です',
          ruby: null,
          hint: null,
          media: { audio: null, image: null },
          autoplayAudio: false,
        },
        answer: {
          heading: longServerHeading,
          ruby: '   ',
          restored: ' server restored ',
          meaning: null,
          sentences: {
            japanese: { text: null, ruby: null },
            english: { text: null, ruby: null },
          },
          notes: [],
          media: { image: null },
          audio: null,
        },
      },
    };

    const { rerender } = render(<StudyCardFace card={card} side="back" />);

    expect(screen.getByTestId('study-cloze-heading')).toHaveTextContent('server restored');
    expect(screen.queryByText('stale-reading', { selector: 'rt' })).not.toBeInTheDocument();
    expect(screen.queryByText('raw restored')).not.toBeInTheDocument();

    rerender(
      <StudyCardFace
        card={{
          ...card,
          presentation: {
            ...card.presentation,
            answer: { ...card.presentation.answer, restored: '   ' },
          },
        }}
        side="back"
      />
    );
    expect(screen.getByTestId('study-cloze-heading')).toHaveTextContent(longServerHeading);
    expect(screen.getByTestId('study-cloze-heading')).toHaveClass('text-2xl');
    expect(screen.queryByText('raw restored')).not.toBeInTheDocument();
  });

  it('preserves plain Japanese sentence rendering on the raw fallback path', () => {
    render(
      <StudyCardFace
        card={{
          ...baseCard,
          prompt: { cueText: '会社' },
          answer: {
            expression: '会社',
            sentenceJp: '会社です',
            sentenceJpKana: '会社[かいしゃ]です',
          },
        }}
        side="back"
      />
    );

    expect(screen.getByText('会社です')).toBeInTheDocument();
    expect(screen.queryByText('かいしゃ', { selector: 'rt' })).not.toBeInTheDocument();
  });

  it('renders stored bracket furigana on the prompt side', () => {
    render(<StudyCardFace card={baseCard} side="front" />);

    expect(screen.getByText('会社', { selector: 'ruby' })).toBeInTheDocument();
    expect(screen.getByText('かいしゃ', { selector: 'rt' })).toBeInTheDocument();
  });

  it('renders recognition prompt furigana when stored readings contain segmentation spaces', () => {
    render(
      <StudyCardFace
        side="front"
        card={{
          ...baseCard,
          prompt: {
            cueText: '子どもが公園で転んで、少し泣いてしまった。',
            cueReading:
              '子[こ]どもが 公園[こうえん]で 転[ころ]んで、少[すこ]し 泣[な]いてしまった。',
          },
          answer: {
            expression: '子どもが公園で転んで、少し泣いてしまった。',
            expressionReading:
              '子[こ]どもが 公園[こうえん]で 転[ころ]んで、少[すこ]し 泣[な]いてしまった。',
            meaning: 'The child fell down at the park and ended up crying a little.',
          },
        }}
      />
    );

    expect(screen.getByText('こ', { selector: 'rt' })).toBeInTheDocument();
    expect(screen.getByText('こうえん', { selector: 'rt' })).toBeInTheDocument();
    expect(screen.getByText('ころ', { selector: 'rt' })).toBeInTheDocument();
    expect(screen.getByText('すこ', { selector: 'rt' })).toBeInTheDocument();
    expect(screen.getByText('な', { selector: 'rt' })).toBeInTheDocument();
  });

  it('does not replace prompt kanji with an unannotated kana reading', () => {
    render(
      <StudyCardFace
        side="front"
        card={{
          ...baseCard,
          answer: {
            ...baseCard.answer,
            expressionReading: undefined,
          },
        }}
      />
    );

    expect(screen.getByText('会社')).toBeInTheDocument();
    expect(screen.queryByText('かいしゃ')).not.toBeInTheDocument();
  });

  it('renders optional answer images on cloze reveal sides', () => {
    render(
      <StudyCardFace
        side="back"
        card={{
          ...baseCard,
          cardType: 'cloze',
          prompt: {
            clozeText: '会社で働く',
            clozeDisplayText: '[...]で働く',
          },
          answer: {
            restoredText: '会社で働く',
            restoredTextReading: '会社[かいしゃ]で働く',
            meaning: 'work at a company',
            answerImage: {
              filename: 'company.webp',
              url: 'https://example.com/company.webp',
              mediaKind: 'image',
              source: 'generated',
            },
          },
        }}
      />
    );

    expect(screen.getByAltText('Answer visual')).toHaveAttribute(
      'src',
      'https://example.com/company.webp'
    );
    expect(screen.getByTestId('study-answer-image-layout')).toHaveClass(
      'items-center',
      'md:grid-cols-[minmax(18rem,1fr)_minmax(20rem,1fr)]'
    );
  });

  it('places answer images before text details in focus review layout', () => {
    render(
      <StudyCardFace
        side="back"
        layout="mobile-focus"
        card={{
          ...baseCard,
          answer: {
            ...baseCard.answer,
            notes: 'Short note.',
            answerImage: {
              filename: 'company.webp',
              url: 'https://example.com/company.webp',
              mediaKind: 'image',
              source: 'generated',
            },
          },
        }}
      />
    );

    expect(screen.getByTestId('study-answer-image-layout')).toHaveClass(
      'items-start',
      'md:items-center',
      'md:grid-cols-[minmax(18rem,1fr)_minmax(20rem,1fr)]'
    );
    expect(screen.getByTestId('study-answer-image-column')).toHaveClass(
      'md:border-r',
      'md:border-gray-300/80',
      'md:pr-8'
    );
    expect(screen.getByAltText('Answer visual')).not.toHaveClass('ring-1', 'shadow-sm');
    expect(screen.getByAltText('Answer visual')).toHaveClass('md:max-h-[48dvh]');
  });

  it('reuses prompt images in the split back layout when no answer image exists', () => {
    render(
      <StudyCardFace
        side="back"
        layout="mobile-focus"
        card={{
          ...baseCard,
          cardType: 'production',
          prompt: {
            cueImage: {
              filename: 'cloudy.png',
              url: 'https://example.com/cloudy.png',
              mediaKind: 'image',
              source: 'generated',
            },
            cueMeaning: '名詞',
          },
          answer: {
            expression: '曇り',
            expressionReading: '曇[くも]り',
            meaning: 'cloudy',
            notes: 'Weather word.',
          },
        }}
      />
    );

    expect(screen.getByTestId('study-answer-image-layout')).toHaveClass(
      'items-start',
      'md:items-center',
      'md:grid-cols-[minmax(18rem,1fr)_minmax(20rem,1fr)]'
    );
    expect(screen.getByAltText('Study visual')).toHaveAttribute(
      'src',
      'https://example.com/cloudy.png'
    );
    expect(screen.getByText('cloudy')).toBeInTheDocument();
    expect(screen.getByTestId('study-answer-notes')).toHaveTextContent('Weather word.');
  });

  it('renders optional prompt images on cloze prompt sides', () => {
    render(
      <StudyCardFace
        side="front"
        card={{
          ...baseCard,
          cardType: 'cloze',
          prompt: {
            clozeText: '会社で{{c1::働く}}',
            clozeDisplayText: '会社で[...]',
            cueMeaning: 'work scene',
            cueImage: {
              filename: 'company-front.webp',
              url: 'https://example.com/company-front.webp',
              mediaKind: 'image',
              source: 'generated',
            },
          },
          answer: {
            restoredText: '会社で働く',
            meaning: 'work at a company',
            answerImage: {
              filename: 'company-back.webp',
              url: 'https://example.com/company-back.webp',
              mediaKind: 'image',
              source: 'generated',
            },
          },
        }}
      />
    );

    const frontImage = screen.getByAltText('work scene');
    expect(frontImage).toHaveAttribute('src', 'https://example.com/company-front.webp');
    expect(frontImage).toHaveClass('max-h-[50dvh]');
  });

  it('renders furigana for visible kanji on masked cloze prompt sides', () => {
    render(
      <StudyCardFace
        side="front"
        card={{
          ...baseCard,
          cardType: 'cloze',
          prompt: {
            clozeText: 'お風呂に虫{{c1::がいる}}！',
            clozeDisplayText: 'お風呂に虫[...]！',
          },
          answer: {
            restoredText: 'お風呂に虫がいる！',
            restoredTextReading: 'お風呂[ふろ]に虫[むし]がいる！',
            meaning: 'There are bugs in the bath!',
          },
        }}
      />
    );

    expect(screen.getByText('ふろ', { selector: 'rt' })).toBeInTheDocument();
    expect(screen.getByText('むし', { selector: 'rt' })).toBeInTheDocument();
    expect(screen.getByText(/\[\.\.\.\]/)).toBeInTheDocument();
    expect(screen.queryByText('がいる')).not.toBeInTheDocument();
  });

  it('aligns segmentation spaces before masking furigana on cloze prompt sides', () => {
    render(
      <StudyCardFace
        side="front"
        card={{
          ...baseCard,
          cardType: 'cloze',
          prompt: {
            clozeText: '子どもが公園で{{c1::転んで}}、少し泣いてしまった。',
            clozeDisplayText: '子どもが公園で[...]、少し泣いてしまった。',
          },
          answer: {
            restoredText: '子どもが公園で転んで、少し泣いてしまった。',
            restoredTextReading:
              '子[こ]どもが 公園[こうえん]で 転[ころ]んで、少[すこ]し 泣[な]いてしまった。',
            meaning: 'The child fell down at the park and ended up crying a little.',
          },
        }}
      />
    );

    expect(screen.getByText('こ', { selector: 'rt' })).toBeInTheDocument();
    expect(screen.getByText('こうえん', { selector: 'rt' })).toBeInTheDocument();
    expect(screen.getByText('すこ', { selector: 'rt' })).toBeInTheDocument();
    expect(screen.getByText('な', { selector: 'rt' })).toBeInTheDocument();
    expect(screen.queryByText('ころ', { selector: 'rt' })).not.toBeInTheDocument();
    expect(screen.getByText(/\[\.\.\.\]/)).toBeInTheDocument();
  });

  it('renders Anki-style parenthetical furigana without showing raw parentheses', () => {
    render(
      <StudyCardFace
        side="back"
        card={{
          ...baseCard,
          answer: {
            ...baseCard.answer,
            expression: '予定が変わった。',
            expressionReading: '予定(よてい)が変(か)わった。',
            meaning: 'The plans changed.',
          },
        }}
      />
    );

    const heading = screen.getByTestId('study-japanese-heading');
    expect(within(heading).getByText('よてい', { selector: 'rt' })).toBeInTheDocument();
    expect(within(heading).getByText('か', { selector: 'rt' })).toBeInTheDocument();
    expect(screen.queryByText('予定(よてい)が変(か)わった。')).not.toBeInTheDocument();
    expect(screen.getByText('The plans changed.')).toBeInTheDocument();
  });

  it('renders cloze notes with ruby text instead of bracket notation', () => {
    render(
      <StudyCardFace
        side="back"
        card={{
          ...baseCard,
          cardType: 'cloze',
          prompt: {
            clozeDisplayText: 'お風呂に虫[...]！',
            clozeResolvedHint: 'are',
          },
          answer: {
            restoredText: 'お風呂に虫がいる！',
            restoredTextReading: 'お風呂[ふろ]に虫[むし]がいる！',
            meaning: 'There are bugs in the bath!',
            notes: 'お風呂[ふろ]に虫[むし]がいる！',
            answerAudio: {
              filename: 'cloze.mp3',
              url: 'https://example.com/cloze.mp3',
              mediaKind: 'audio',
              source: 'imported',
            },
          },
        }}
      />
    );

    expect(screen.getAllByText('ふろ', { selector: 'rt' })).toHaveLength(2);
    expect(screen.getAllByText('むし', { selector: 'rt' })).toHaveLength(2);
    expect(screen.queryByText('お風呂[ふろ]に虫[むし]がいる！')).not.toBeInTheDocument();
  });

  it('uses compact note spacing in focus review layout', () => {
    render(
      <StudyCardFace
        side="back"
        layout="mobile-focus"
        card={{
          ...baseCard,
          answer: {
            ...baseCard.answer,
            notes: 'First note.\nSecond note.',
          },
        }}
      />
    );

    const notes = screen.getByTestId('study-answer-notes');
    expect(notes).toHaveClass('space-y-0.5', 'leading-tight');
    expect(notes).not.toHaveClass('md:space-y-3');
    expect(notes).not.toHaveClass('leading-relaxed');
  });

  it('allows long Japanese headings to wrap on both mobile and desktop', () => {
    render(
      <StudyCardFace
        side="back"
        layout="mobile-focus"
        card={{
          ...baseCard,
          answer: {
            ...baseCard.answer,
            expression:
              '違います、これは兄の友達で、今の奥さんです。妹はこれです。この時、まだ中学生でした。',
            expressionReading:
              '違[ちが]います、これは兄[あに]の友達[ともだち]で、今[いま]の奥[おく]さんです。妹[いもうと]はこれです。この時[とき]、まだ中学[ちゅうがく]生[せい]でした。',
            meaning: "No, this is my brother's friend, and now his wife. This is my sister.",
          },
        }}
      />
    );

    expect(screen.getByTestId('study-japanese-heading')).toHaveClass(
      'whitespace-normal',
      'break-words'
    );
    expect(screen.getByTestId('study-japanese-heading')).not.toHaveClass('md:whitespace-nowrap');
  });

  it('renders derived cloze blanks instead of raw manual cloze markup', () => {
    render(
      <StudyCardFace
        side="front"
        card={{
          ...baseCard,
          cardType: 'cloze',
          prompt: {
            clozeText: '試合に{{c1::勝ちました}}。',
            clozeDisplayText: '試合に{{c1::勝ちました}}。',
          },
          answer: {
            restoredText: '試合に勝ちました。',
            meaning: 'I won the match.',
          },
        }}
      />
    );

    expect(screen.getByTestId('study-cloze-prompt')).toHaveTextContent('試合に[...]。');
    expect(screen.queryByText(/{{c1::/)).not.toBeInTheDocument();
  });

  it('keeps cloze prompt hints from clipping descenders', () => {
    render(
      <StudyCardFace
        side="front"
        card={{
          ...baseCard,
          cardType: 'cloze',
          prompt: {
            clozeText: '毎日運動を{{c1::続けています}}。',
            clozeDisplayText: '毎日運動を[...]続けています。',
            clozeResolvedHint: 'continuously (indicates ongoing action)',
          },
          answer: {
            restoredText: '毎日運動を続けています。',
            meaning: 'I exercise every day.',
          },
        }}
      />
    );

    expect(screen.getByText('continuously (indicates ongoing action)')).toHaveClass(
      'leading-snug',
      'pb-1'
    );
  });

  it('renders a manual cloze hint instead of stale resolved metadata', () => {
    render(
      <StudyCardFace
        side="front"
        card={{
          ...baseCard,
          cardType: 'cloze',
          prompt: {
            clozeText: '母が帰る{{c1::まで}}、本を読みます。',
            clozeHint: 'I will read a book until my mother comes home.',
            clozeResolvedHint: 'the endpoint of an ongoing action',
          },
          answer: {
            restoredText: '母が帰るまで、本を読みます。',
          },
        }}
      />
    );

    expect(screen.getByText('I will read a book until my mother comes home.')).toBeInTheDocument();
    expect(screen.queryByText('the endpoint of an ongoing action')).not.toBeInTheDocument();
  });

  it('gives revealed focus-mode answer text enough room for descenders', () => {
    render(
      <StudyCardFace
        side="back"
        layout="mobile-focus"
        card={{
          ...baseCard,
          answer: {
            expression: '雨が降りそうだから、傘を持って行った方がいい。',
            expressionReading:
              '雨[あめ]が降[ふ]りそうだから、傘[かさ]を持[も]って行[い]った方[ほう]がいい。',
            meaning: "It looks like it's going to rain, so you should take an umbrella.",
          },
        }}
      />
    );

    expect(
      screen.getByText("It looks like it's going to rain, so you should take an umbrella.")
    ).toHaveClass('leading-snug', 'pb-[0.08em]');
    expect(screen.getByTestId('study-japanese-heading')).toHaveClass('pb-[0.08em]');
  });

  it('keeps helper meaning hidden on media-led prompt cards', () => {
    render(
      <StudyCardFace
        side="front"
        card={{
          ...baseCard,
          prompt: {
            cueAudio: {
              filename: 'prompt.mp3',
              url: 'https://example.com/prompt.mp3',
              mediaKind: 'audio',
              source: 'imported',
            },
            cueImage: {
              filename: 'prompt.png',
              url: 'https://example.com/prompt.png',
              mediaKind: 'image',
              source: 'imported_image',
            },
            cueMeaning: 'hidden helper meaning',
          },
        }}
      />
    );

    expect(screen.getByAltText('Study prompt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play prompt audio' })).toBeInTheDocument();
    expect(screen.queryByText('hidden helper meaning')).not.toBeInTheDocument();
  });

  it('shows the Japanese part-of-speech label under image-only production prompts', () => {
    render(
      <StudyCardFace
        side="front"
        card={{
          ...baseCard,
          cardType: 'production',
          prompt: {
            cueImage: {
              filename: 'cloudy.png',
              url: 'https://example.com/cloudy.png',
              mediaKind: 'image',
              source: 'generated',
            },
            cueMeaning: '名詞',
          },
        }}
      />
    );

    expect(screen.getByAltText('Study prompt')).toHaveClass('max-h-[56dvh]');
    expect(screen.getByText('名詞')).toBeInTheDocument();
  });

  it('decodes HTML entities in plain study text fields', () => {
    render(
      <StudyCardFace
        card={{
          ...baseCard,
          answer: {
            ...baseCard.answer,
            meaning: 'Someone, please come. It&#x27;s an accident.',
          },
        }}
        side="back"
      />
    );

    expect(screen.getByText("Someone, please come. It's an accident.")).toBeInTheDocument();
  });
});
