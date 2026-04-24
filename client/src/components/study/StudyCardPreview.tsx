import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Ref } from 'react';
import type { StudyCardSummary } from '@languageflow/shared/src/types';
import { useTranslation } from 'react-i18next';

import StudyRubyText from './StudyRubyText';
import {
  getAudioMimeType,
  isAudioLedPromptCard,
  isMediaLedPromptCard,
  toAssetUrl,
} from './studyCardUtils';
import { getHeadlineClasses, toDisplayText, toNotesList } from './studyTextUtils';

export interface AudioPlayerHandle {
  play: () => Promise<boolean>;
  stop: () => void;
}

const AudioPlayer = forwardRef<
  AudioPlayerHandle,
  {
    label: string;
    showTimeline?: boolean;
    timelineMode?: 'always' | 'desktop';
    testId?: string;
    url: string;
  }
>(({ label, showTimeline = false, timelineMode = 'always', testId, url }, ref) => {
  const { t } = useTranslation('study');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      setErrorMessage(null);
      // Autoplay and manual replay intentionally share the same error surface because
      // browsers like iOS Safari may reject play() until media is user-gesture eligible.
      await audio.play();
      return true;
    } catch (error) {
      console.error(`Unable to play ${label}:`, error);
      setPlaying(false);
      setErrorMessage(t('preview.audioFailed'));
      return false;
    }
  }, [label, t]);

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
    const handlePlay = () => {
      setPlaying(true);
      setErrorMessage(null);
    };
    const handleCanPlay = () => setErrorMessage(null);
    const handleError = () => {
      setPlaying(false);
      setErrorMessage(t('preview.audioFailed'));
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);

    return () => {
      audio.pause();
      audio.currentTime = 0;
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
    };
  }, [t, url]);

  useEffect(() => {
    setErrorMessage(null);
  }, [url]);

  const handleClick = () => {
    if (playing) {
      stop();
      return;
    }

    play().catch(() => {});
  };

  const showButton = !showTimeline || timelineMode === 'desktop';
  const buttonClasses =
    timelineMode === 'desktop' ? 'flex justify-center md:hidden' : 'flex justify-center';
  const timelineClasses =
    timelineMode === 'desktop'
      ? 'mx-auto hidden w-full max-w-xl md:block'
      : 'mx-auto w-full max-w-xl';

  return (
    <div className="space-y-3" data-testid={testId}>
      {showButton ? (
        <div className={buttonClasses}>
          <button
            type="button"
            onClick={handleClick}
            aria-label={label}
            data-testid={testId ? `${testId}-button` : undefined}
            className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-gray-400 bg-white text-navy shadow-sm transition hover:border-navy hover:shadow-md sm:h-16 sm:w-16 md:h-20 md:w-20"
          >
            {playing ? (
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6 fill-current sm:h-7 sm:w-7 md:h-9 md:w-9"
                aria-hidden="true"
              >
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="ml-1 h-6 w-6 fill-current sm:h-7 sm:w-7 md:h-9 md:w-9"
                aria-hidden="true"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        </div>
      ) : null}

      <audio
        key={url}
        ref={audioRef}
        preload="metadata"
        controls={showTimeline}
        aria-label={label}
        className={showTimeline ? timelineClasses : 'hidden'}
      >
        <source
          src={url}
          type={getAudioMimeType(url)}
          data-testid={testId ? `${testId}-source` : undefined}
        />
      </audio>
      {errorMessage ? (
        <p
          className="text-center text-sm text-red-600"
          data-testid={testId ? `${testId}-error` : undefined}
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
});

AudioPlayer.displayName = 'AudioPlayer';

type StudyCardLayout = 'default' | 'mobile-focus';

const renderJapaneseHeading = (card: StudyCardSummary, compactMobile: boolean) => {
  const readingText = card.answer.expressionReading ?? card.prompt.cueReading;
  const headlineText =
    card.answer.expressionReading ?? card.answer.expression ?? card.prompt.cueReading ?? '';

  if (readingText) {
    return (
      <StudyRubyText
        as="div"
        text={readingText}
        testId="study-japanese-heading"
        className={`study-card-reading text-center font-semibold leading-tight text-black ${getHeadlineClasses(
          headlineText,
          { compactMobile }
        )}`}
        rtClassName="text-[0.34em] font-medium text-gray-500"
      />
    );
  }

  if (card.answer.expression) {
    return (
      <p
        className={`text-center font-semibold leading-tight text-black ${getHeadlineClasses(
          card.answer.expression,
          { compactMobile }
        )}`}
      >
        {toDisplayText(card.answer.expression)}
      </p>
    );
  }

  return null;
};

const renderNotes = (notes: string[], containerClasses: string, noteClasses: string) => {
  if (notes.length === 0) return null;

  const noteCounts = new Map<string, number>();
  const keyedNotes = notes.map((note) => {
    const nextCount = (noteCounts.get(note) ?? 0) + 1;
    noteCounts.set(note, nextCount);

    return {
      key: `${note}-${nextCount}`,
      note,
    };
  });

  return (
    <div className={containerClasses}>
      {keyedNotes.map(({ key, note }) => (
        <p key={key} className={noteClasses}>
          <span aria-hidden="true">• </span>
          <StudyRubyText
            as="span"
            text={note}
            rtClassName="text-[0.72em] font-medium text-gray-500"
          />
        </p>
      ))}
    </div>
  );
};

export const StudyCardFace = ({
  answerAudioRef,
  card,
  layout = 'default',
  promptAudioRef,
  side,
}: {
  answerAudioRef?: Ref<AudioPlayerHandle>;
  card: StudyCardSummary;
  layout?: StudyCardLayout;
  promptAudioRef?: Ref<AudioPlayerHandle>;
  side: 'front' | 'back';
}) => {
  const compactMobile = layout === 'mobile-focus';

  if (side === 'front') {
    if (card.cardType === 'cloze') {
      return (
        <div
          className={
            compactMobile
              ? 'space-y-3 text-center md:space-y-6'
              : 'space-y-4 text-center sm:space-y-6'
          }
        >
          <p
            className={`mx-auto max-w-5xl leading-relaxed text-black ${
              compactMobile
                ? 'text-2xl sm:text-4xl md:text-6xl'
                : 'text-3xl sm:text-4xl md:text-6xl'
            }`}
          >
            {toDisplayText(card.prompt.clozeDisplayText ?? card.prompt.clozeText ?? '')}
          </p>
          {card.prompt.clozeResolvedHint ? (
            <p
              className={
                compactMobile
                  ? 'text-base text-gray-700 sm:text-2xl md:text-3xl'
                  : 'text-xl text-gray-700 sm:text-2xl md:text-3xl'
              }
            >
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
        <div
          className={`flex flex-col items-center justify-center text-center sm:min-h-[58vh] sm:gap-8 ${
            compactMobile ? 'min-h-[calc(100dvh-12rem)] gap-4' : 'min-h-[calc(100dvh-14rem)] gap-5'
          }`}
        >
          {cueImageUrl ? (
            <img
              src={cueImageUrl}
              alt="Study prompt"
              className={`mx-auto w-auto max-w-full object-contain sm:max-h-[50vh] ${
                compactMobile ? 'max-h-[40dvh]' : 'max-h-[42dvh]'
              }`}
            />
          ) : null}
          {cueAudioUrl ? (
            <div className={cueImageUrl ? 'pt-2' : ''}>
              <AudioPlayer
                ref={promptAudioRef}
                url={cueAudioUrl}
                label={audioLedPrompt ? 'Replay prompt audio' : 'Play prompt audio'}
                testId="study-prompt-audio"
              />
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <div
        className={
          compactMobile
            ? 'space-y-4 text-center md:space-y-8'
            : 'space-y-5 text-center sm:space-y-8'
        }
      >
        {cueImageUrl ? (
          <img
            src={cueImageUrl}
            alt={card.prompt.cueMeaning ?? 'Study prompt'}
            className={`mx-auto object-contain sm:max-h-80 ${
              compactMobile ? 'max-h-[32dvh] rounded-lg' : 'max-h-[36dvh] rounded-xl'
            }`}
          />
        ) : null}
        {cueAudioUrl ? (
          <AudioPlayer ref={promptAudioRef} url={cueAudioUrl} label="Play prompt audio" />
        ) : null}
        {card.prompt.cueText ? (
          <p
            className={`mx-auto max-w-4xl text-center font-semibold leading-tight text-black ${getHeadlineClasses(
              card.prompt.cueText,
              { compactMobile }
            )}`}
          >
            {toDisplayText(card.prompt.cueText)}
          </p>
        ) : null}
        {card.prompt.cueMeaning ? (
          <p
            className={`mx-auto max-w-3xl text-gray-700 sm:text-xl md:text-2xl ${
              compactMobile ? 'text-base' : 'text-lg'
            }`}
          >
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
    return (
      <div
        className={
          compactMobile
            ? 'space-y-3 text-center md:space-y-8'
            : 'space-y-5 text-center sm:space-y-8'
        }
      >
        {card.answer.restoredTextReading || card.answer.restoredText ? (
          <StudyRubyText
            as="div"
            text={card.answer.restoredTextReading ?? card.answer.restoredText}
            testId="study-cloze-heading"
            className={`study-card-reading mx-auto max-w-5xl text-center font-semibold leading-tight text-black ${getHeadlineClasses(
              card.answer.restoredText,
              { compactMobile }
            )}`}
            rtClassName="text-[0.34em] font-medium text-gray-500"
          />
        ) : null}
        {answerAudioUrl ? (
          <AudioPlayer
            ref={answerAudioRef}
            url={answerAudioUrl}
            label="Play answer audio"
            showTimeline
            timelineMode={compactMobile ? 'desktop' : 'always'}
            testId="study-answer-audio"
          />
        ) : null}
        <div className="mx-auto h-px w-full max-w-3xl bg-gray-400/80" />
        {card.answer.meaning ? (
          <p
            className={`mx-auto max-w-4xl text-gray-800 ${
              compactMobile
                ? 'text-base leading-snug sm:text-2xl md:text-4xl'
                : 'text-xl sm:text-3xl md:text-4xl'
            }`}
          >
            {toDisplayText(card.answer.meaning)}
          </p>
        ) : null}
        {renderNotes(
          notes,
          compactMobile
            ? 'mx-auto max-w-5xl space-y-1 text-xs leading-snug text-gray-500 sm:space-y-2 sm:text-lg md:space-y-3 md:text-xl'
            : 'mx-auto max-w-5xl space-y-2 text-sm leading-relaxed text-gray-500 sm:space-y-3 sm:text-xl',
          'text-gray-500'
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
    <div
      className={
        compactMobile ? 'space-y-3 text-center md:space-y-8' : 'space-y-5 text-center sm:space-y-8'
      }
    >
      {renderJapaneseHeading(card, compactMobile)}
      {answerAudioUrl ? (
        <AudioPlayer
          ref={answerAudioRef}
          url={answerAudioUrl}
          label="Play answer audio"
          showTimeline
          timelineMode={compactMobile ? 'desktop' : 'always'}
          testId="study-answer-audio"
        />
      ) : null}
      <div className="mx-auto h-px w-full max-w-3xl bg-gray-400/80" />
      {card.answer.restoredText ? (
        <p
          className={`mx-auto max-w-4xl text-black ${
            compactMobile
              ? 'text-base leading-snug sm:text-2xl md:text-4xl'
              : 'text-xl leading-relaxed sm:text-3xl md:text-4xl'
          }`}
        >
          {toDisplayText(card.answer.restoredText)}
        </p>
      ) : null}
      {card.answer.meaning ? (
        <p
          className={`mx-auto max-w-4xl text-gray-800 ${
            compactMobile
              ? 'text-base leading-snug sm:text-xl md:text-3xl'
              : 'text-lg sm:text-2xl md:text-3xl'
          }`}
        >
          {toDisplayText(card.answer.meaning)}
        </p>
      ) : null}
      {card.answer.sentenceJp ? (
        <p
          className={`mx-auto max-w-4xl text-black ${
            compactMobile
              ? 'text-sm leading-snug sm:text-lg md:text-xl'
              : 'text-base leading-relaxed sm:text-xl'
          }`}
        >
          {toDisplayText(card.answer.sentenceJp)}
        </p>
      ) : null}
      {card.answer.sentenceEn ? (
        <p
          className={`mx-auto max-w-3xl text-gray-600 ${
            compactMobile ? 'text-xs leading-snug sm:text-base md:text-lg' : 'text-sm sm:text-lg'
          }`}
        >
          {toDisplayText(card.answer.sentenceEn)}
        </p>
      ) : null}
      {renderNotes(
        notes,
        compactMobile
          ? 'mx-auto max-w-5xl space-y-1 text-xs leading-snug text-gray-600 sm:space-y-2 sm:text-base md:space-y-3 md:text-lg'
          : 'mx-auto max-w-5xl space-y-2 text-sm leading-relaxed text-gray-600 sm:space-y-3 sm:text-lg',
        'text-gray-600'
      )}
      {answerImageUrl ? (
        <img
          src={answerImageUrl}
          alt="Answer visual"
          className={`mx-auto object-contain sm:max-h-72 ${
            compactMobile ? 'max-h-[30dvh] rounded-lg' : 'max-h-[34dvh] rounded-xl'
          }`}
        />
      ) : null}
      {!answerAudioUrl ? (
        <p className="text-sm uppercase tracking-[0.18em] text-gray-400">
          Answer audio is being backfilled for this card.
        </p>
      ) : null}
      {card.answer.expression && !card.answer.meaning && !notes.length ? (
        <div className="text-sm text-gray-400">
          This card only has the core answer content imported so far.
        </div>
      ) : null}
    </div>
  );
};
