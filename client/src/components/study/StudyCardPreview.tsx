import type { Ref } from 'react';
import type { StudyCardSummary } from '@languageflow/shared/src/types';

import StudyAudioPlayer from './StudyAudioPlayer';
import type { AudioPlayerHandle } from './StudyAudioPlayer';
import StudyRubyText from './StudyRubyText';
import { isAudioLedPromptCard, isMediaLedPromptCard, toAssetUrl } from './studyCardUtils';
import { getHeadlineClasses, toDisplayText, toNotesList } from './studyTextUtils';

export type { AudioPlayerHandle };

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
              <StudyAudioPlayer
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
          <StudyAudioPlayer ref={promptAudioRef} url={cueAudioUrl} label="Play prompt audio" />
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
          <StudyAudioPlayer
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
        <StudyAudioPlayer
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
