import type { Ref } from 'react';
import { STUDY_CANDIDATE_VISUAL_POS_LABELS_JA } from '@languageflow/shared/src/studyConstants';
import { deriveClozePresentation } from '@languageflow/shared/src/studyCloze';
import type { StudyCardSummary } from '@languageflow/shared/src/types';

import StudyAudioPlayer from './StudyAudioPlayer';
import type { AudioPlayerHandle } from './StudyAudioPlayer';
import StudyPitchAccentPanel from './StudyPitchAccentPanel';
import StudyRubyText from './StudyRubyText';
import { isAudioLedPromptCard, isMediaLedPromptCard, toAssetUrl } from './studyCardUtils';
import {
  getHeadlineClasses,
  parseRubySegments,
  toDisplayText,
  toNotesList,
} from './studyTextUtils';

export type { AudioPlayerHandle };

type StudyCardLayout = 'default' | 'mobile-focus';

const STUDY_CANDIDATE_VISUAL_POS_LABELS = new Set<string>(STUDY_CANDIDATE_VISUAL_POS_LABELS_JA);

const isVisualProductionCueLabel = (value: string | null | undefined) =>
  Boolean(value && STUDY_CANDIDATE_VISUAL_POS_LABELS.has(value));

const CLOZE_MARKUP_PATTERN = /\{\{c\d+::/;
// Keeps glyph descenders clear when review text sits inside clipped/scrolling card containers.
const DESCENDER_SAFE_PADDING_CLASS = 'pb-[0.08em]';

const toRubyPlainText = (value: string) =>
  parseRubySegments(value)
    .map((segment) => (segment.kind === 'ruby' ? segment.base : segment.text) ?? '')
    .join('');

const toRubyMatchText = (value: string) => value.replace(/\s+/gu, '');

const matchingRubyText = (plainText: string, candidates: Array<string | null | undefined>) =>
  candidates.find(
    (candidate) =>
      candidate &&
      parseRubySegments(candidate).some((segment) => segment.kind === 'ruby') &&
      toRubyMatchText(toRubyPlainText(candidate)) === toRubyMatchText(plainText)
  );

const alignRubyTextToPlainText = (rubyText: string, plainText: string) => {
  let plainIndex = 0;

  const appendPlainWhitespace = (value: string) => {
    const whitespace = plainText.slice(plainIndex).match(/^\s+/u)?.[0] ?? '';
    plainIndex += whitespace.length;
    return value + whitespace;
  };

  const alignedText = parseRubySegments(rubyText).reduce<string | null>((current, segment) => {
    if (current === null) return null;

    if (segment.kind === 'ruby') {
      const aligned = appendPlainWhitespace(current);
      const base = segment.base ?? '';
      if (!plainText.startsWith(base, plainIndex)) return null;

      plainIndex += base.length;
      return `${aligned}${base}[${segment.reading ?? ''}]`;
    }

    return Array.from(segment.text ?? '').reduce<string | null>((text, character) => {
      if (text === null || /\s/u.test(character)) return text;

      const aligned = appendPlainWhitespace(text);
      if (!plainText.startsWith(character, plainIndex)) return null;

      plainIndex += character.length;
      return aligned + character;
    }, current);
  }, '');

  if (alignedText === null) return null;
  const completeText = appendPlainWhitespace(alignedText);
  return plainIndex === plainText.length ? completeText : null;
};

const sliceRubyText = (value: string, start: number, end: number) => {
  let offset = 0;

  return parseRubySegments(value)
    .map((segment) => {
      const plain = (segment.kind === 'ruby' ? segment.base : segment.text) ?? '';
      const segmentStart = offset;
      const segmentEnd = offset + plain.length;
      offset = segmentEnd;

      const sliceStart = Math.max(start, segmentStart);
      const sliceEnd = Math.min(end, segmentEnd);
      if (sliceStart >= sliceEnd) return '';

      const visible = plain.slice(sliceStart - segmentStart, sliceEnd - segmentStart);
      if (segment.kind === 'ruby' && sliceStart === segmentStart && sliceEnd === segmentEnd) {
        return `${visible}[${segment.reading ?? ''}]`;
      }

      return visible;
    })
    .join('');
};

const toMaskedRubyText = (
  displayText: string,
  restoredText: string | null | undefined,
  restoredTextReading: string | null | undefined
) => {
  if (!restoredText || !restoredTextReading) {
    return displayText;
  }

  const alignedReading = alignRubyTextToPlainText(restoredTextReading, restoredText);
  if (!alignedReading) return displayText;

  // deriveClozePresentation masks only the active cloze, so the display has at most one marker.
  const markerIndex = displayText.indexOf('[...]');
  if (markerIndex < 0) return displayText;

  const prefix = displayText.slice(0, markerIndex);
  const suffix = displayText.slice(markerIndex + '[...]'.length);
  if (!restoredText.startsWith(prefix) || !restoredText.endsWith(suffix)) return displayText;

  return `${sliceRubyText(alignedReading, 0, prefix.length)}[...]${sliceRubyText(
    alignedReading,
    restoredText.length - suffix.length,
    restoredText.length
  )}`;
};

const renderJapaneseHeading = (card: StudyCardSummary, compactMobile: boolean) => {
  const readingText = card.answer.expressionReading ?? card.prompt.cueReading;
  const headlineText =
    card.answer.expressionReading ?? card.answer.expression ?? card.prompt.cueReading ?? '';
  const headingMinFontSizePx = compactMobile ? 24 : 28;
  const headingWrapClasses =
    'max-w-full min-w-0 whitespace-normal break-words md:max-w-5xl md:whitespace-nowrap';

  if (readingText) {
    return (
      <StudyRubyText
        as="div"
        text={readingText}
        testId="study-japanese-heading"
        autoFitSingleLine
        minFontSizePx={headingMinFontSizePx}
        className={`study-card-reading ${DESCENDER_SAFE_PADDING_CLASS} mx-auto w-full text-center font-semibold leading-tight text-black ${headingWrapClasses} ${getHeadlineClasses(
          headlineText,
          { compactMobile }
        )}`}
        rtClassName="text-[0.34em] font-medium text-gray-500"
      />
    );
  }

  if (card.answer.expression) {
    return (
      <StudyRubyText
        as="div"
        text={card.answer.expression}
        autoFitSingleLine
        minFontSizePx={headingMinFontSizePx}
        className={`${DESCENDER_SAFE_PADDING_CLASS} mx-auto w-full text-center font-semibold leading-tight text-black ${headingWrapClasses} ${getHeadlineClasses(
          card.answer.expression,
          { compactMobile }
        )}`}
      />
    );
  }

  return null;
};

const renderNotes = (
  notes: string[],
  containerClasses: string,
  noteClasses: string,
  testId?: string
) => {
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
    <div className={containerClasses} data-testid={testId}>
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
  resolvePitchAccent = true,
  side,
}: {
  answerAudioRef?: Ref<AudioPlayerHandle>;
  card: StudyCardSummary;
  layout?: StudyCardLayout;
  promptAudioRef?: Ref<AudioPlayerHandle>;
  resolvePitchAccent?: boolean;
  side: 'front' | 'back';
}) => {
  const compactMobile = layout === 'mobile-focus';

  if (side === 'front') {
    if (card.cardType === 'cloze') {
      const rawDisplayText = card.prompt.clozeDisplayText ?? null;
      const derived = deriveClozePresentation(card.prompt.clozeText ?? rawDisplayText);
      const clozeDisplayText =
        rawDisplayText && !CLOZE_MARKUP_PATTERN.test(rawDisplayText)
          ? rawDisplayText
          : derived.displayText;
      const clozeRubyText = toMaskedRubyText(
        clozeDisplayText ?? '',
        card.answer.restoredText ?? derived.restoredText,
        card.answer.restoredTextReading
      );
      const cueImageUrl = toAssetUrl(card.prompt.cueImage?.url);

      return (
        <div
          className={
            compactMobile
              ? 'space-y-3 text-center md:space-y-6'
              : 'space-y-4 text-center sm:space-y-6'
          }
        >
          {cueImageUrl ? (
            <img
              src={cueImageUrl}
              alt={card.prompt.cueMeaning ?? 'Study prompt'}
              className={`mx-auto object-contain ${
                compactMobile ? 'max-h-[46dvh] rounded-lg' : 'max-h-[50dvh] rounded-xl'
              }`}
            />
          ) : null}
          <StudyRubyText
            as="p"
            text={clozeRubyText}
            testId="study-cloze-prompt"
            className={`mx-auto max-w-5xl leading-relaxed text-black ${
              compactMobile
                ? 'text-2xl sm:text-4xl md:text-6xl'
                : 'text-3xl sm:text-4xl md:text-6xl'
            }`}
            rtClassName="text-[0.34em] font-medium text-gray-500"
          />
          {card.prompt.clozeResolvedHint ? (
            <p
              className={
                compactMobile
                  ? 'pb-1 text-base leading-snug text-gray-700 sm:text-2xl md:text-3xl'
                  : 'pb-1 text-xl leading-snug text-gray-700 sm:text-2xl md:text-3xl'
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
              className={`mx-auto w-auto max-w-full object-contain ${
                compactMobile ? 'max-h-[52dvh]' : 'max-h-[56dvh]'
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
          {isVisualProductionCueLabel(card.prompt.cueMeaning) && cueImageUrl && !cueAudioUrl ? (
            <p
              className={`font-semibold text-gray-700 ${
                compactMobile ? 'text-base sm:text-xl' : 'text-lg sm:text-2xl'
              }`}
            >
              {toDisplayText(card.prompt.cueMeaning)}
            </p>
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
            className={`mx-auto object-contain ${
              compactMobile ? 'max-h-[46dvh] rounded-lg' : 'max-h-[50dvh] rounded-xl'
            }`}
          />
        ) : null}
        {cueAudioUrl ? (
          <StudyAudioPlayer ref={promptAudioRef} url={cueAudioUrl} label="Play prompt audio" />
        ) : null}
        {card.prompt.cueText ? (
          <StudyRubyText
            as="div"
            text={
              matchingRubyText(card.prompt.cueText, [
                card.prompt.cueReading,
                card.answer.expressionReading,
              ]) ?? card.prompt.cueText
            }
            autoFitSingleLine
            minFontSizePx={compactMobile ? 24 : 28}
            className={`mx-auto w-full max-w-full min-w-0 whitespace-normal break-words text-center font-semibold leading-tight text-black md:max-w-5xl md:whitespace-nowrap ${getHeadlineClasses(
              card.prompt.cueText,
              { compactMobile }
            )}`}
            rtClassName="text-[0.34em] font-medium text-gray-500"
          />
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
  const reviewImage = card.answer.answerImage ?? card.prompt.cueImage ?? null;
  const reviewImageUrl = toAssetUrl(reviewImage?.url);
  const reviewImageAlt = card.answer.answerImage ? 'Answer visual' : 'Study visual';
  const notes = toNotesList(card.answer.notes);
  const reviewImageClasses = compactMobile
    ? 'max-h-[30dvh] w-auto max-w-full rounded-lg md:max-h-[48dvh] md:w-full md:rounded-xl'
    : 'max-h-[38dvh] w-auto max-w-full rounded-xl md:max-h-[46dvh] md:w-full';
  const imageLayoutClasses = compactMobile
    ? 'mx-auto grid w-full max-w-full min-w-0 items-start gap-3 text-center md:max-w-6xl md:grid-cols-[minmax(18rem,1fr)_minmax(20rem,1fr)] md:items-center md:gap-8 md:text-left'
    : 'mx-auto grid w-full max-w-6xl min-w-0 items-center gap-4 text-center md:grid-cols-[minmax(18rem,1fr)_minmax(20rem,1fr)] md:gap-8 md:text-left';
  const imageColumnClasses =
    'mx-auto flex w-full min-w-0 justify-center md:block md:border-r md:border-gray-300/80 md:pr-8';
  const renderedAnswerDetails = (
    <>
      {card.answer.restoredText ? (
        <p
          className={`mx-auto max-w-full break-words text-black md:max-w-4xl ${
            compactMobile
              ? `${DESCENDER_SAFE_PADDING_CLASS} text-base leading-snug sm:text-2xl md:text-4xl`
              : 'text-xl leading-relaxed sm:text-3xl md:text-4xl'
          }`}
        >
          {toDisplayText(card.answer.restoredText)}
        </p>
      ) : null}
      {card.answer.meaning ? (
        <p
          className={`mx-auto max-w-full break-words text-gray-800 md:max-w-4xl ${
            compactMobile
              ? `${DESCENDER_SAFE_PADDING_CLASS} text-base leading-snug sm:text-xl md:text-3xl`
              : 'text-lg sm:text-2xl md:text-3xl'
          }`}
        >
          {toDisplayText(card.answer.meaning)}
        </p>
      ) : null}
      {card.answer.sentenceJp ? (
        <p
          className={`mx-auto max-w-full break-words text-black md:max-w-4xl ${
            compactMobile
              ? `${DESCENDER_SAFE_PADDING_CLASS} text-sm leading-snug sm:text-lg md:text-xl`
              : 'text-base leading-relaxed sm:text-xl'
          }`}
        >
          {toDisplayText(card.answer.sentenceJp)}
        </p>
      ) : null}
      {card.answer.sentenceEn ? (
        <p
          className={`mx-auto max-w-full break-words text-gray-600 md:max-w-3xl ${
            compactMobile
              ? `${DESCENDER_SAFE_PADDING_CLASS} text-xs leading-snug sm:text-base md:text-lg`
              : 'text-sm sm:text-lg'
          }`}
        >
          {toDisplayText(card.answer.sentenceEn)}
        </p>
      ) : null}
      {renderNotes(
        notes,
        compactMobile
          ? 'mx-auto w-full max-w-full space-y-0.5 text-xs leading-tight text-gray-600 sm:space-y-1 sm:text-base md:max-w-5xl md:text-lg'
          : 'mx-auto max-w-5xl space-y-1 text-sm leading-snug text-gray-600 sm:text-lg',
        'break-words text-gray-600',
        'study-answer-notes'
      )}
    </>
  );

  if (card.cardType === 'cloze') {
    const renderedClozeAnswerDetails = (
      <>
        {card.answer.meaning ? (
          <p
            className={`mx-auto max-w-4xl text-gray-800 ${
              compactMobile
                ? `${DESCENDER_SAFE_PADDING_CLASS} text-base leading-snug sm:text-2xl md:text-4xl`
                : 'text-xl sm:text-3xl md:text-4xl'
            }`}
          >
            {toDisplayText(card.answer.meaning)}
          </p>
        ) : null}
        {renderNotes(
          notes,
          compactMobile
            ? 'mx-auto max-w-5xl space-y-0.5 text-xs leading-tight text-gray-500 sm:space-y-1 sm:text-lg md:text-xl'
            : 'mx-auto max-w-5xl space-y-1 text-sm leading-snug text-gray-500 sm:text-xl',
          'text-gray-500',
          'study-answer-notes'
        )}
      </>
    );

    return (
      <div
        className={
          compactMobile
            ? 'w-full min-w-0 space-y-3 overflow-x-clip text-center md:space-y-8'
            : 'space-y-5 text-center sm:space-y-8'
        }
      >
        {card.answer.restoredTextReading || card.answer.restoredText ? (
          <StudyRubyText
            as="div"
            text={card.answer.restoredTextReading ?? card.answer.restoredText}
            testId="study-cloze-heading"
            autoFitSingleLine
            minFontSizePx={compactMobile ? 24 : 28}
            className={`study-card-reading ${DESCENDER_SAFE_PADDING_CLASS} mx-auto w-full max-w-full min-w-0 whitespace-normal break-words text-center font-semibold leading-tight text-black md:max-w-5xl md:whitespace-nowrap ${getHeadlineClasses(
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
            renderMode={compactMobile ? 'hidden' : 'default'}
            showTimeline
            timelineMode={compactMobile ? 'desktop' : 'always'}
            testId="study-answer-audio"
          />
        ) : null}
        <StudyPitchAccentPanel card={card} enabled={resolvePitchAccent} />
        <div className="mx-auto h-px w-full max-w-3xl bg-gray-400/80" />
        {reviewImageUrl ? (
          <div className={imageLayoutClasses} data-testid="study-answer-image-layout">
            <div className={imageColumnClasses} data-testid="study-answer-image-column">
              <img
                src={reviewImageUrl}
                alt={reviewImageAlt}
                className={`mx-auto object-contain md:mx-0 ${reviewImageClasses}`}
              />
            </div>
            <div className="min-w-0 space-y-2 md:space-y-3">{renderedClozeAnswerDetails}</div>
          </div>
        ) : (
          renderedClozeAnswerDetails
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
        compactMobile
          ? 'w-full min-w-0 space-y-3 overflow-x-clip text-center md:space-y-8'
          : 'space-y-5 text-center sm:space-y-8'
      }
    >
      {renderJapaneseHeading(card, compactMobile)}
      {answerAudioUrl ? (
        <StudyAudioPlayer
          ref={answerAudioRef}
          url={answerAudioUrl}
          label="Play answer audio"
          renderMode={compactMobile ? 'hidden' : 'default'}
          showTimeline
          timelineMode={compactMobile ? 'desktop' : 'always'}
          testId="study-answer-audio"
        />
      ) : null}
      <StudyPitchAccentPanel card={card} enabled={resolvePitchAccent} />
      <div className="mx-auto h-px w-full max-w-3xl bg-gray-400/80" />
      {reviewImageUrl ? (
        <div className={imageLayoutClasses} data-testid="study-answer-image-layout">
          <div className={imageColumnClasses} data-testid="study-answer-image-column">
            <img
              src={reviewImageUrl}
              alt={reviewImageAlt}
              className={`mx-auto object-contain md:mx-0 ${reviewImageClasses}`}
            />
          </div>
          <div className="min-w-0 space-y-2 md:space-y-3">{renderedAnswerDetails}</div>
        </div>
      ) : (
        renderedAnswerDetails
      )}
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
