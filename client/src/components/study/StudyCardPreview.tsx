import type { Ref } from 'react';
import type { StudyCardSummary } from '@languageflow/shared/src/types';

import StudyAudioPlayer from './StudyAudioPlayer';
import type { AudioPlayerHandle } from './StudyAudioPlayer';
import StudyCardFront from './StudyCardFront';
import StudyPitchAccentPanel from './StudyPitchAccentPanel';
import StudyRubyText from './StudyRubyText';
import toRubyPlainText from './rubyTextUtils';
import {
  firstNonBlankPresentationText,
  getStudyCardPresentation,
  getStudyCardReviewAudio,
  toAssetUrl,
} from './studyCardUtils';
import { getHeadlineClasses, toDisplayText, toNotesList } from './studyTextUtils';

export type { AudioPlayerHandle };

type StudyCardLayout = 'default' | 'mobile-focus';

// Keeps glyph descenders clear when review text sits inside clipped/scrolling card containers.
const DESCENDER_SAFE_PADDING_CLASS = 'pb-[0.08em]';

const renderJapaneseHeading = (card: StudyCardSummary, compactMobile: boolean) => {
  const presentation = getStudyCardPresentation(card);
  const readingText = presentation
    ? firstNonBlankPresentationText(presentation.answer.ruby)
    : (card.answer.expressionReading ?? card.prompt.cueReading);
  const answerText = presentation
    ? firstNonBlankPresentationText(presentation.answer.heading)
    : card.answer.expression;
  const headlineText = presentation
    ? (readingText ?? answerText ?? '')
    : (readingText ?? answerText ?? card.prompt.cueReading ?? '');
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

  if (answerText) {
    return (
      <StudyRubyText
        as="div"
        text={answerText}
        autoFitSingleLine
        minFontSizePx={headingMinFontSizePx}
        className={`${DESCENDER_SAFE_PADDING_CLASS} mx-auto w-full text-center font-semibold leading-tight text-black ${headingWrapClasses} ${getHeadlineClasses(
          answerText,
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
  const presentation = getStudyCardPresentation(card);
  const isClozePresentation = presentation
    ? presentation.front.mode === 'cloze'
    : card.cardType === 'cloze';

  if (side === 'front') {
    return (
      <StudyCardFront card={card} compactMobile={compactMobile} promptAudioRef={promptAudioRef} />
    );
  }

  const answerAudio = getStudyCardReviewAudio(card);
  const answerAudioUrl = toAssetUrl(answerAudio?.url);
  const reviewImage = presentation
    ? presentation.answer.media.image
    : (card.answer.answerImage ?? card.prompt.cueImage ?? null);
  const reviewImageUrl = toAssetUrl(reviewImage?.url);
  const usesAnswerVisual = presentation
    ? Boolean(presentation.answer.media.image)
    : Boolean(card.answer.answerImage);
  const reviewImageAlt = usesAnswerVisual ? 'Answer visual' : 'Study visual';
  const notes = presentation ? presentation.answer.notes : toNotesList(card.answer.notes);
  const restoredText = presentation
    ? firstNonBlankPresentationText(presentation.answer.restored)
    : card.answer.restoredText;
  const meaning = presentation
    ? firstNonBlankPresentationText(presentation.answer.meaning)
    : card.answer.meaning;
  const answerHeading = presentation
    ? firstNonBlankPresentationText(presentation.answer.heading)
    : card.answer.expression;
  const japaneseSentence = presentation
    ? {
        text: firstNonBlankPresentationText(presentation.answer.sentences.japanese.text),
        ruby: firstNonBlankPresentationText(presentation.answer.sentences.japanese.ruby),
      }
    : { text: card.answer.sentenceJp ?? null, ruby: card.answer.sentenceJpKana ?? null };
  const englishSentence = presentation
    ? {
        text: firstNonBlankPresentationText(presentation.answer.sentences.english.text),
        ruby: firstNonBlankPresentationText(presentation.answer.sentences.english.ruby),
      }
    : { text: card.answer.sentenceEn ?? null, ruby: null };
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
      {restoredText ? (
        <p
          className={`mx-auto max-w-full break-words text-black md:max-w-4xl ${
            compactMobile
              ? `${DESCENDER_SAFE_PADDING_CLASS} text-base leading-snug sm:text-2xl md:text-4xl`
              : 'text-xl leading-relaxed sm:text-3xl md:text-4xl'
          }`}
        >
          {toDisplayText(restoredText)}
        </p>
      ) : null}
      {meaning ? (
        <p
          className={`mx-auto max-w-full break-words text-gray-800 md:max-w-4xl ${
            compactMobile
              ? `${DESCENDER_SAFE_PADDING_CLASS} text-base leading-snug sm:text-xl md:text-3xl`
              : 'text-lg sm:text-2xl md:text-3xl'
          }`}
        >
          {toDisplayText(meaning)}
        </p>
      ) : null}
      {japaneseSentence.text ? (
        <p
          className={`mx-auto max-w-full break-words text-black md:max-w-4xl ${
            compactMobile
              ? `${DESCENDER_SAFE_PADDING_CLASS} text-sm leading-snug sm:text-lg md:text-xl`
              : 'text-base leading-relaxed sm:text-xl'
          }`}
        >
          {presentation ? (
            <StudyRubyText as="span" text={japaneseSentence.ruby ?? japaneseSentence.text} />
          ) : (
            toDisplayText(japaneseSentence.text)
          )}
        </p>
      ) : null}
      {englishSentence.text ? (
        <p
          className={`mx-auto max-w-full break-words text-gray-600 md:max-w-3xl ${
            compactMobile
              ? `${DESCENDER_SAFE_PADDING_CLASS} text-xs leading-snug sm:text-base md:text-lg`
              : 'text-sm sm:text-lg'
          }`}
        >
          {toDisplayText(englishSentence.text)}
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

  if (isClozePresentation) {
    const clozeHeading = presentation
      ? firstNonBlankPresentationText(
          presentation.answer.ruby,
          presentation.answer.restored,
          presentation.answer.heading
        )
      : (card.answer.restoredTextReading ?? restoredText);
    const clozeHeadlineText = clozeHeading ? toRubyPlainText(clozeHeading) : null;
    const renderedClozeAnswerDetails = (
      <>
        {meaning ? (
          <p
            className={`mx-auto max-w-4xl text-gray-800 ${
              compactMobile
                ? `${DESCENDER_SAFE_PADDING_CLASS} text-base leading-snug sm:text-2xl md:text-4xl`
                : 'text-xl sm:text-3xl md:text-4xl'
            }`}
          >
            {toDisplayText(meaning)}
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
        {clozeHeading ? (
          <StudyRubyText
            as="div"
            text={clozeHeading}
            testId="study-cloze-heading"
            autoFitSingleLine
            minFontSizePx={compactMobile ? 24 : 28}
            className={`study-card-reading ${DESCENDER_SAFE_PADDING_CLASS} mx-auto w-full max-w-full min-w-0 whitespace-normal break-words text-center font-semibold leading-tight text-black md:max-w-5xl md:whitespace-nowrap ${getHeadlineClasses(
              clozeHeadlineText,
              { compactMobile }
            )}`}
            rtClassName="text-[0.34em] font-medium text-gray-500"
          />
        ) : null}
        {answerAudioUrl ? (
          <StudyAudioPlayer
            ref={answerAudioRef}
            filename={answerAudio?.filename}
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
          filename={answerAudio?.filename}
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
      {answerHeading && !meaning && !notes.length ? (
        <div className="text-sm text-gray-400">
          This card only has the core answer content imported so far.
        </div>
      ) : null}
    </div>
  );
};
