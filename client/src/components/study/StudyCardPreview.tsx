import type { ReactNode, Ref } from 'react';
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

type StudyCardFaceProps = {
  answerAudioRef?: Ref<AudioPlayerHandle>;
  card: StudyCardSummary;
  layout?: StudyCardLayout;
  promptAudioRef?: Ref<AudioPlayerHandle>;
  resolvePitchAccent?: boolean;
  side: 'front' | 'back';
};

type StudyCardBackModel = ReturnType<typeof getStudyCardBackModel>;

const getStudyCardBackModel = (card: StudyCardSummary) => {
  const presentation = getStudyCardPresentation(card);
  const answerAudio = getStudyCardReviewAudio(card);
  if (presentation) {
    const restoredText = firstNonBlankPresentationText(presentation.answer.restored);
    return {
      answerAudio,
      answerHeading: firstNonBlankPresentationText(presentation.answer.heading),
      clozeHeading: firstNonBlankPresentationText(
        presentation.answer.ruby,
        presentation.answer.restored,
        presentation.answer.heading
      ),
      englishSentence: firstNonBlankPresentationText(presentation.answer.sentences.english.text),
      isClozePresentation: presentation.front.mode === 'cloze',
      japaneseSentence: {
        ruby: firstNonBlankPresentationText(presentation.answer.sentences.japanese.ruby),
        text: firstNonBlankPresentationText(presentation.answer.sentences.japanese.text),
      },
      meaning: firstNonBlankPresentationText(presentation.answer.meaning),
      notes: presentation.answer.notes,
      presentationBacked: true,
      restoredText,
      reviewImage: presentation.answer.media.image,
      reviewImageAlt: presentation.answer.media.image ? 'Answer visual' : 'Study visual',
    };
  }

  const { restoredText } = card.answer;
  return {
    answerAudio,
    answerHeading: card.answer.expression,
    clozeHeading: card.answer.restoredTextReading ?? restoredText,
    englishSentence: card.answer.sentenceEn ?? null,
    isClozePresentation: card.cardType === 'cloze',
    japaneseSentence: {
      ruby: card.answer.sentenceJpKana ?? null,
      text: card.answer.sentenceJp ?? null,
    },
    meaning: card.answer.meaning,
    notes: toNotesList(card.answer.notes),
    presentationBacked: false,
    restoredText,
    reviewImage: card.answer.answerImage ?? card.prompt.cueImage ?? null,
    reviewImageAlt: card.answer.answerImage ? 'Answer visual' : 'Study visual',
  };
};

const getBackLayoutClasses = (compactMobile: boolean) => ({
  container: compactMobile
    ? 'w-full min-w-0 space-y-3 overflow-x-clip text-center md:space-y-8'
    : 'space-y-5 text-center sm:space-y-8',
  image: compactMobile
    ? 'max-h-[30dvh] w-auto max-w-full rounded-lg md:max-h-[48dvh] md:w-full md:rounded-xl'
    : 'max-h-[38dvh] w-auto max-w-full rounded-xl md:max-h-[46dvh] md:w-full',
  imageLayout: compactMobile
    ? 'mx-auto grid w-full max-w-full min-w-0 items-start gap-3 text-center md:max-w-6xl md:grid-cols-[minmax(18rem,1fr)_minmax(20rem,1fr)] md:items-center md:gap-8 md:text-left'
    : 'mx-auto grid w-full max-w-6xl min-w-0 items-center gap-4 text-center md:grid-cols-[minmax(18rem,1fr)_minmax(20rem,1fr)] md:gap-8 md:text-left',
});

const AnswerDetails = ({
  compactMobile,
  model,
}: {
  compactMobile: boolean;
  model: StudyCardBackModel;
}) => (
  <>
    {model.restoredText ? (
      <p
        className={`mx-auto max-w-full break-words text-black md:max-w-4xl ${
          compactMobile
            ? `${DESCENDER_SAFE_PADDING_CLASS} text-base leading-snug sm:text-2xl md:text-4xl`
            : 'text-xl leading-relaxed sm:text-3xl md:text-4xl'
        }`}
      >
        {toDisplayText(model.restoredText)}
      </p>
    ) : null}
    {model.meaning ? (
      <p
        className={`mx-auto max-w-full break-words text-gray-800 md:max-w-4xl ${
          compactMobile
            ? `${DESCENDER_SAFE_PADDING_CLASS} text-base leading-snug sm:text-xl md:text-3xl`
            : 'text-lg sm:text-2xl md:text-3xl'
        }`}
      >
        {toDisplayText(model.meaning)}
      </p>
    ) : null}
    {model.japaneseSentence.text ? (
      <p
        className={`mx-auto max-w-full break-words text-black md:max-w-4xl ${
          compactMobile
            ? `${DESCENDER_SAFE_PADDING_CLASS} text-sm leading-snug sm:text-lg md:text-xl`
            : 'text-base leading-relaxed sm:text-xl'
        }`}
      >
        {model.presentationBacked ? (
          <StudyRubyText
            as="span"
            text={model.japaneseSentence.ruby ?? model.japaneseSentence.text}
          />
        ) : (
          toDisplayText(model.japaneseSentence.text)
        )}
      </p>
    ) : null}
    {model.englishSentence ? (
      <p
        className={`mx-auto max-w-full break-words text-gray-600 md:max-w-3xl ${
          compactMobile
            ? `${DESCENDER_SAFE_PADDING_CLASS} text-xs leading-snug sm:text-base md:text-lg`
            : 'text-sm sm:text-lg'
        }`}
      >
        {toDisplayText(model.englishSentence)}
      </p>
    ) : null}
    {renderNotes(
      model.notes,
      compactMobile
        ? 'mx-auto w-full max-w-full space-y-0.5 text-xs leading-tight text-gray-600 sm:space-y-1 sm:text-base md:max-w-5xl md:text-lg'
        : 'mx-auto max-w-5xl space-y-1 text-sm leading-snug text-gray-600 sm:text-lg',
      'break-words text-gray-600',
      'study-answer-notes'
    )}
  </>
);

const ClozeAnswerDetails = ({
  compactMobile,
  model,
}: {
  compactMobile: boolean;
  model: StudyCardBackModel;
}) => (
  <>
    {model.meaning ? (
      <p
        className={`mx-auto max-w-4xl text-gray-800 ${
          compactMobile
            ? `${DESCENDER_SAFE_PADDING_CLASS} text-base leading-snug sm:text-2xl md:text-4xl`
            : 'text-xl sm:text-3xl md:text-4xl'
        }`}
      >
        {toDisplayText(model.meaning)}
      </p>
    ) : null}
    {renderNotes(
      model.notes,
      compactMobile
        ? 'mx-auto max-w-5xl space-y-0.5 text-xs leading-tight text-gray-500 sm:space-y-1 sm:text-lg md:text-xl'
        : 'mx-auto max-w-5xl space-y-1 text-sm leading-snug text-gray-500 sm:text-xl',
      'text-gray-500',
      'study-answer-notes'
    )}
  </>
);

const AnswerAudio = ({
  answerAudioRef,
  compactMobile,
  model,
}: {
  answerAudioRef?: Ref<AudioPlayerHandle>;
  compactMobile: boolean;
  model: StudyCardBackModel;
}) => {
  const answerAudioUrl = toAssetUrl(model.answerAudio?.url);
  if (!answerAudioUrl) return null;

  return (
    <StudyAudioPlayer
      ref={answerAudioRef}
      filename={model.answerAudio?.filename}
      url={answerAudioUrl}
      label="Play answer audio"
      renderMode={compactMobile ? 'hidden' : 'default'}
      showTimeline
      timelineMode={compactMobile ? 'desktop' : 'always'}
      testId="study-answer-audio"
    />
  );
};

const AnswerImageLayout = ({
  compactMobile,
  details,
  model,
}: {
  compactMobile: boolean;
  details: ReactNode;
  model: StudyCardBackModel;
}) => {
  const reviewImageUrl = toAssetUrl(model.reviewImage?.url);
  if (!reviewImageUrl) return details;

  const classes = getBackLayoutClasses(compactMobile);
  return (
    <div className={classes.imageLayout} data-testid="study-answer-image-layout">
      <div
        className="mx-auto flex w-full min-w-0 justify-center md:block md:border-r md:border-gray-300/80 md:pr-8"
        data-testid="study-answer-image-column"
      >
        <img
          src={reviewImageUrl}
          alt={model.reviewImageAlt}
          className={`mx-auto object-contain md:mx-0 ${classes.image}`}
        />
      </div>
      <div className="min-w-0 space-y-2 md:space-y-3">{details}</div>
    </div>
  );
};

const MissingAnswerAudioNotice = ({ model }: { model: StudyCardBackModel }) =>
  toAssetUrl(model.answerAudio?.url) ? null : (
    <p className="text-sm uppercase tracking-[0.18em] text-gray-400">
      Answer audio is being backfilled for this card.
    </p>
  );

const ClozeStudyCardBack = ({
  answerAudioRef,
  card,
  compactMobile,
  model,
  resolvePitchAccent,
}: {
  answerAudioRef?: Ref<AudioPlayerHandle>;
  card: StudyCardSummary;
  compactMobile: boolean;
  model: StudyCardBackModel;
  resolvePitchAccent: boolean;
}) => {
  const clozeHeadlineText = model.clozeHeading ? toRubyPlainText(model.clozeHeading) : null;
  const details = <ClozeAnswerDetails compactMobile={compactMobile} model={model} />;

  return (
    <div className={getBackLayoutClasses(compactMobile).container}>
      {model.clozeHeading ? (
        <StudyRubyText
          as="div"
          text={model.clozeHeading}
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
      <AnswerAudio answerAudioRef={answerAudioRef} compactMobile={compactMobile} model={model} />
      <StudyPitchAccentPanel card={card} enabled={resolvePitchAccent} />
      <div className="mx-auto h-px w-full max-w-3xl bg-gray-400/80" />
      <AnswerImageLayout compactMobile={compactMobile} details={details} model={model} />
      <MissingAnswerAudioNotice model={model} />
    </div>
  );
};

const StandardStudyCardBack = ({
  answerAudioRef,
  card,
  compactMobile,
  model,
  resolvePitchAccent,
}: {
  answerAudioRef?: Ref<AudioPlayerHandle>;
  card: StudyCardSummary;
  compactMobile: boolean;
  model: StudyCardBackModel;
  resolvePitchAccent: boolean;
}) => {
  const details = <AnswerDetails compactMobile={compactMobile} model={model} />;

  return (
    <div className={getBackLayoutClasses(compactMobile).container}>
      {renderJapaneseHeading(card, compactMobile)}
      <AnswerAudio answerAudioRef={answerAudioRef} compactMobile={compactMobile} model={model} />
      <StudyPitchAccentPanel card={card} enabled={resolvePitchAccent} />
      <div className="mx-auto h-px w-full max-w-3xl bg-gray-400/80" />
      <AnswerImageLayout compactMobile={compactMobile} details={details} model={model} />
      <MissingAnswerAudioNotice model={model} />
      {model.answerHeading && !model.meaning && !model.notes.length ? (
        <div className="text-sm text-gray-400">
          This card only has the core answer content imported so far.
        </div>
      ) : null}
    </div>
  );
};

const StudyCardBack = ({
  answerAudioRef,
  card,
  compactMobile,
  resolvePitchAccent,
}: {
  answerAudioRef?: Ref<AudioPlayerHandle>;
  card: StudyCardSummary;
  compactMobile: boolean;
  resolvePitchAccent: boolean;
}) => {
  const model = getStudyCardBackModel(card);
  const props = { answerAudioRef, card, compactMobile, model, resolvePitchAccent };

  return model.isClozePresentation ? (
    <ClozeStudyCardBack {...props} />
  ) : (
    <StandardStudyCardBack {...props} />
  );
};

export const StudyCardFace = ({
  answerAudioRef,
  card,
  layout = 'default',
  promptAudioRef,
  resolvePitchAccent = true,
  side,
}: StudyCardFaceProps) => {
  const compactMobile = layout === 'mobile-focus';
  if (side === 'front') {
    return (
      <StudyCardFront card={card} compactMobile={compactMobile} promptAudioRef={promptAudioRef} />
    );
  }

  return (
    <StudyCardBack
      answerAudioRef={answerAudioRef}
      card={card}
      compactMobile={compactMobile}
      resolvePitchAccent={resolvePitchAccent}
    />
  );
};
