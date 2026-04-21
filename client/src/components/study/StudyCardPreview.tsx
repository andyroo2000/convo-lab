import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import type { StudyCardSummary } from '@shared/types';

import { API_URL } from '../../config';

export interface AudioPlayerHandle {
  play: () => Promise<boolean>;
  stop: () => void;
}

export const toAssetUrl = (url?: string | null) => {
  if (!url) return null;
  return url.startsWith('/') ? `${API_URL}${url}` : url;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_match, codePoint) => {
      const parsed = Number.parseInt(codePoint, 10);
      return Number.isNaN(parsed) ? _match : String.fromCodePoint(parsed);
    })
    .replace(/&#x([0-9a-f]+);/gi, (_match, codePoint) => {
      const parsed = Number.parseInt(codePoint, 16);
      return Number.isNaN(parsed) ? _match : String.fromCodePoint(parsed);
    });

const stripTags = (value: string) =>
  decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/blockquote>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  ).trim();

function isHiragana(char: string): boolean {
  if (!char) return false;
  const code = char.charCodeAt(0);
  return code >= 0x3040 && code <= 0x309f;
}

function isKatakana(char: string): boolean {
  if (!char) return false;
  const code = char.charCodeAt(0);
  return code >= 0x30a0 && code <= 0x30ff;
}

function isKana(char: string): boolean {
  return isHiragana(char) || isKatakana(char);
}

const toRubyHtml = (value?: string | null) => {
  if (!value) return null;

  const rubyHtml = value.replace(
    /([\u4E00-\u9FAF\u3040-\u309F\u30A0-\u30FF]+)\[([^\]]+)\]/g,
    (_match, base, reading) => {
      const cleanReading = reading.replace(/\s+/g, '');

      let kanjiStart = 0;
      while (kanjiStart < base.length && isKana(base[kanjiStart])) {
        kanjiStart += 1;
      }

      let kanjiEnd = base.length;
      while (kanjiEnd > kanjiStart && isKana(base[kanjiEnd - 1])) {
        kanjiEnd -= 1;
      }

      if (kanjiStart >= base.length || kanjiStart >= kanjiEnd) {
        return `<ruby class="study-ruby">${escapeHtml(base)}<rt>${escapeHtml(cleanReading)}</rt></ruby>`;
      }

      const prefix = base.substring(0, kanjiStart);
      const kanjiPart = base.substring(kanjiStart, kanjiEnd);
      const suffix = base.substring(kanjiEnd);

      let adjustedReading = cleanReading;
      if (suffix && cleanReading.endsWith(suffix)) {
        adjustedReading = cleanReading.substring(0, cleanReading.length - suffix.length);
      }

      return `${escapeHtml(prefix)}<ruby class="study-ruby">${escapeHtml(kanjiPart)}<rt>${escapeHtml(
        adjustedReading
      )}</rt></ruby>${escapeHtml(suffix)}`;
    }
  );

  return rubyHtml.includes('<ruby') ? rubyHtml : escapeHtml(value);
};

const toDisplayText = (value?: string | null) => {
  if (!value) return null;
  return decodeHtmlEntities(value).trim();
};

const toNotesList = (value?: string | null) => {
  if (!value) return [];

  return stripTags(value)
    .split('\n')
    .map((line) => line.replace(/^[•\-\s]+/, '').trim())
    .filter(Boolean);
};

const getHeadlineClasses = (value?: string | null) => {
  const length = value?.length ?? 0;

  if (length > 40) return 'text-3xl md:text-4xl';
  if (length > 20) return 'text-4xl md:text-5xl';
  return 'text-5xl md:text-6xl';
};

export const isAudioLedPromptCard = (card: StudyCardSummary) =>
  Boolean(
    card.prompt.cueAudio?.url &&
      !card.prompt.cueText &&
      !card.prompt.cueMeaning &&
      !card.prompt.clozeText
  );

const isMediaLedPromptCard = (card: StudyCardSummary) =>
  Boolean((card.prompt.cueAudio?.url || card.prompt.cueImage?.url) && !card.prompt.cueText && !card.prompt.clozeText);

const AudioPlayer = forwardRef<
  AudioPlayerHandle,
  {
    url: string;
    label: string;
    showTimeline?: boolean;
  }
>(function AudioPlayer({ url, label, showTimeline = false }, ref) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setPlaying(false);
  }, []);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return false;

    try {
      await audio.play();
      return true;
    } catch (error) {
      console.error(`Unable to play ${label}:`, error);
      setPlaying(false);
      return false;
    }
  }, [label]);

  useImperativeHandle(
    ref,
    () => ({
      play,
      stop,
    }),
    [play, stop]
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const handleEnded = () => setPlaying(false);
    const handlePause = () => setPlaying(false);
    const handlePlay = () => setPlaying(true);

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);

    return () => {
      audio.pause();
      audio.currentTime = 0;
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
    };
  }, [url]);

  return (
    <div className="space-y-3">
      {!showTimeline ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => {
              void (playing ? (stop(), Promise.resolve(true)) : play());
            }}
            aria-label={label}
            className="inline-flex h-20 w-20 items-center justify-center rounded-full border border-gray-400 bg-white text-navy shadow-sm transition hover:border-navy hover:shadow-md"
          >
            {playing ? (
              <svg viewBox="0 0 24 24" className="h-9 w-9 fill-current" aria-hidden="true">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="ml-1 h-9 w-9 fill-current" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        </div>
      ) : null}

      <audio
        key={url}
        ref={audioRef}
        src={url}
        preload="metadata"
        controls={showTimeline}
        className={showTimeline ? 'mx-auto w-full max-w-xl' : 'hidden'}
      >
        <source src={url} type="audio/mpeg" />
      </audio>
    </div>
  );
});

const renderJapaneseHeading = (card: StudyCardSummary) => {
  const rubyHtml = toRubyHtml(card.answer.expressionReading) ?? toRubyHtml(card.prompt.cueReading);
  const headlineText =
    card.answer.expressionReading ?? card.answer.expression ?? card.prompt.cueReading ?? '';
  const headlineClasses = getHeadlineClasses(headlineText);

  if (rubyHtml) {
    return (
      <div
        className={`study-card-reading text-center font-semibold leading-tight text-black [&_rt]:text-[0.34em] [&_rt]:font-medium [&_rt]:text-gray-500 ${headlineClasses}`}
        dangerouslySetInnerHTML={{ __html: rubyHtml }}
      />
    );
  }

  if (card.answer.expression) {
    return (
      <p className={`text-center font-semibold leading-tight text-black ${headlineClasses}`}>
        {toDisplayText(card.answer.expression)}
      </p>
    );
  }

  return null;
};

const renderNotes = (notes: string[], containerClasses: string, noteClasses: string) => {
  if (notes.length === 0) return null;

  return (
    <div className={containerClasses}>
      {notes.map((note, index) => {
        const noteHtml = toRubyHtml(note);

        if (noteHtml) {
          return (
            <p
              key={`${note}-${index}`}
              className={noteClasses}
              dangerouslySetInnerHTML={{ __html: `&bull; ${noteHtml}` }}
            />
          );
        }

        return (
          <p key={`${note}-${index}`} className={noteClasses}>
            • {note}
          </p>
        );
      })}
    </div>
  );
};

export const StudyCardFace = ({
  card,
  side,
  promptAudioRef,
  answerAudioRef,
}: {
  card: StudyCardSummary;
  side: 'front' | 'back';
  promptAudioRef?: Ref<AudioPlayerHandle>;
  answerAudioRef?: Ref<AudioPlayerHandle>;
}) => {
  if (side === 'front') {
    if (card.cardType === 'cloze') {
      return (
        <div className="space-y-6 text-center">
          <p className="mx-auto max-w-5xl text-4xl leading-relaxed text-black md:text-6xl">
            {toDisplayText(card.prompt.clozeDisplayText ?? card.prompt.clozeText ?? '')}
          </p>
          {card.prompt.clozeResolvedHint ? (
            <p className="text-2xl text-gray-700 md:text-3xl">
              {toDisplayText(card.prompt.clozeResolvedHint)}
            </p>
          ) : null}
        </div>
      );
    }

    const cueAudioUrl = toAssetUrl(card.prompt.cueAudio?.url);
    const cueImageUrl = toAssetUrl(card.prompt.cueImage?.url);
    const mediaLedPrompt = isMediaLedPromptCard(card);
    const audioLedPrompt = isAudioLedPromptCard(card);

    if (mediaLedPrompt) {
      return (
        <div className="flex min-h-[58vh] flex-col items-center justify-center gap-8 text-center">
          {cueImageUrl ? (
            <img
              src={cueImageUrl}
              alt="Study prompt"
              className="mx-auto max-h-[50vh] w-auto max-w-full object-contain"
            />
          ) : null}
          {cueAudioUrl ? (
            <div className={cueImageUrl ? 'pt-2' : ''}>
              <AudioPlayer
                ref={promptAudioRef}
                url={cueAudioUrl}
                label={audioLedPrompt ? 'Replay prompt audio' : 'Play prompt audio'}
              />
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <div className="space-y-8 text-center">
        {cueImageUrl ? (
          <img
            src={cueImageUrl}
            alt={card.prompt.cueMeaning ?? 'Study prompt'}
            className="mx-auto max-h-80 rounded-xl object-contain"
          />
        ) : null}
        {cueAudioUrl ? (
          <AudioPlayer ref={promptAudioRef} url={cueAudioUrl} label="Play prompt audio" />
        ) : null}
        {card.prompt.cueText ? (
          <p
            className={`mx-auto max-w-4xl text-center font-semibold leading-tight text-black ${getHeadlineClasses(card.prompt.cueText)}`}
          >
            {toDisplayText(card.prompt.cueText)}
          </p>
        ) : null}
        {card.prompt.cueMeaning ? (
          <p className="mx-auto max-w-3xl text-xl text-gray-700 md:text-2xl">
            {toDisplayText(card.prompt.cueMeaning)}
          </p>
        ) : null}
      </div>
    );
  }

  const answerAudioUrl = toAssetUrl(card.answer.answerAudio?.url);
  const answerImageUrl = toAssetUrl(card.answer.answerImage?.url);
  const notes = toNotesList(card.answer.notes);

  if (card.cardType === 'cloze') {
    const clozeHeadingHtml =
      toRubyHtml(card.answer.restoredTextReading) ?? escapeHtml(card.answer.restoredText ?? '');

    return (
      <div className="space-y-8 text-center">
        {card.answer.restoredText ? (
          <div
            className={`study-card-reading mx-auto max-w-5xl text-center font-semibold leading-tight text-black [&_rt]:text-[0.34em] [&_rt]:font-medium [&_rt]:text-gray-500 ${getHeadlineClasses(card.answer.restoredText)}`}
            dangerouslySetInnerHTML={{ __html: clozeHeadingHtml }}
          />
        ) : null}
        {answerAudioUrl ? (
          <AudioPlayer ref={answerAudioRef} url={answerAudioUrl} label="Play answer audio" showTimeline />
        ) : null}
        <div className="mx-auto h-px w-full max-w-3xl bg-gray-400/80" />
        {card.answer.meaning ? (
          <p className="mx-auto max-w-4xl text-3xl text-gray-800 md:text-4xl">
            {toDisplayText(card.answer.meaning)}
          </p>
        ) : null}
        {renderNotes(
          notes,
          'mx-auto max-w-5xl space-y-3 text-xl leading-relaxed text-gray-500',
          '[&_rt]:text-[0.7em] [&_rt]:font-medium [&_rt]:text-gray-400'
        )}
        {!answerAudioUrl ? (
          <p className="text-sm uppercase tracking-[0.18em] text-gray-400">
            Answer audio is being backfilled for this card.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-8 text-center">
      {renderJapaneseHeading(card)}
      {answerAudioUrl ? (
        <AudioPlayer ref={answerAudioRef} url={answerAudioUrl} label="Play answer audio" showTimeline />
      ) : null}
      <div className="mx-auto h-px w-full max-w-3xl bg-gray-400/80" />
      {card.answer.restoredText ? (
        <p className="mx-auto max-w-4xl text-3xl leading-relaxed text-black md:text-4xl">
          {toDisplayText(card.answer.restoredText)}
        </p>
      ) : null}
      {card.answer.meaning ? (
        <p className="mx-auto max-w-4xl text-2xl text-gray-800 md:text-3xl">
          {toDisplayText(card.answer.meaning)}
        </p>
      ) : null}
      {card.answer.sentenceJp ? (
        <p className="mx-auto max-w-4xl text-xl leading-relaxed text-black">
          {toDisplayText(card.answer.sentenceJp)}
        </p>
      ) : null}
      {card.answer.sentenceEn ? (
        <p className="mx-auto max-w-3xl text-lg text-gray-600">{toDisplayText(card.answer.sentenceEn)}</p>
      ) : null}
      {renderNotes(
        notes,
        'mx-auto max-w-5xl space-y-3 text-lg leading-relaxed text-gray-600',
        '[&_rt]:text-[0.72em] [&_rt]:font-medium [&_rt]:text-gray-500'
      )}
      {answerImageUrl ? (
        <img
          src={answerImageUrl}
          alt="Answer visual"
          className="mx-auto max-h-72 rounded-xl object-contain"
        />
      ) : null}
      {!answerAudioUrl ? (
        <p className="text-sm uppercase tracking-[0.18em] text-gray-400">
          Answer audio is being backfilled for this card.
        </p>
      ) : null}
      {card.answer.expression && !card.answer.meaning && !notes.length ? (
        <div className="text-sm text-gray-400">This card only has the core answer content imported so far.</div>
      ) : null}
    </div>
  );
};
