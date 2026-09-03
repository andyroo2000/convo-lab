import type { Ref } from 'react';
import { STUDY_CANDIDATE_VISUAL_POS_LABELS_JA } from '@languageflow/shared/src/studyConstants';
import { deriveClozePresentation } from '@languageflow/shared/src/studyCloze';
import type { StudyCardSummary } from '@languageflow/shared/src/types';

import type { AudioPlayerHandle } from './StudyAudioPlayer';
import StudyAudioPlayer from './StudyAudioPlayer';
import {
  firstNonBlankPresentationText,
  getStudyCardPresentation,
  isAudioLedPromptCard,
  isMediaLedPromptCard,
  toAssetUrl,
} from './studyCardUtils';
import StudyRubyText from './StudyRubyText';
import toRubyPlainText from './rubyTextUtils';
import { getHeadlineClasses, parseRubySegments, toDisplayText } from './studyTextUtils';

const CLOZE_MARKUP_PATTERN = /\{\{c\d+::/;
const STUDY_CANDIDATE_VISUAL_POS_LABELS = new Set<string>(STUDY_CANDIDATE_VISUAL_POS_LABELS_JA);

type Character = string;
type DisplayText = string;
type PlainText = string;
type PresentationText = string | null | undefined;
type RubyMarkup = string;
type TextIndex = number;

const toRubyMatchText = (value: PlainText) => value.replace(/\s+/gu, '');

const matchingRubyText = (plainText: PlainText, candidates: PresentationText[]) =>
  candidates.find(
    (candidate) =>
      candidate &&
      parseRubySegments(candidate).some((segment) => segment.kind === 'ruby') &&
      toRubyMatchText(toRubyPlainText(candidate)) === toRubyMatchText(plainText)
  );

type RubySegment = ReturnType<typeof parseRubySegments>[number];

class RubyAlignmentCursor {
  index = 0;

  constructor(readonly plainText: PlainText) {}

  appendWhitespace(value: DisplayText) {
    const whitespace = this.plainText.slice(this.index).match(/^\s+/u)?.[0] ?? '';
    this.index += whitespace.length;
    return value + whitespace;
  }

  consume(value: DisplayText) {
    if (!this.plainText.startsWith(value, this.index)) return false;
    this.index += value.length;
    return true;
  }
}

const alignPlainCharacter = (
  cursor: RubyAlignmentCursor,
  current: string | null,
  character: Character
) => {
  if (current === null) return null;
  if (/\s/u.test(character)) return current;

  const aligned = cursor.appendWhitespace(current);
  if (!cursor.consume(character)) return null;
  return aligned + character;
};

const alignRubySegment = (cursor: RubyAlignmentCursor, current: string, segment: RubySegment) => {
  const aligned = cursor.appendWhitespace(current);
  const base = segment.base ?? '';
  if (!cursor.consume(base)) return null;
  return `${aligned}${base}[${segment.reading ?? ''}]`;
};

const alignSegment = (
  cursor: RubyAlignmentCursor,
  current: string | null,
  segment: RubySegment
) => {
  if (current === null) return null;
  if (segment.kind === 'ruby') return alignRubySegment(cursor, current, segment);
  return Array.from(segment.text ?? '').reduce<string | null>(
    (text, character) => alignPlainCharacter(cursor, text, character),
    current
  );
};

const alignRubyTextToPlainText = (rubyText: RubyMarkup, plainText: PlainText) => {
  const cursor = new RubyAlignmentCursor(plainText);
  const alignedText = parseRubySegments(rubyText).reduce<string | null>(
    (current, segment) => alignSegment(cursor, current, segment),
    ''
  );
  if (alignedText === null) return null;
  const completeText = cursor.appendWhitespace(alignedText);
  return cursor.index === plainText.length ? completeText : null;
};

const renderSegmentSlice = (
  segment: RubySegment,
  segmentStart: TextIndex,
  start: TextIndex,
  end: TextIndex
) => {
  const plain = (segment.kind === 'ruby' ? segment.base : segment.text) ?? '';
  const segmentEnd = segmentStart + plain.length;
  const sliceStart = Math.max(start, segmentStart);
  const sliceEnd = Math.min(end, segmentEnd);
  if (sliceStart >= sliceEnd) return '';

  const visible = plain.slice(sliceStart - segmentStart, sliceEnd - segmentStart);
  if (segment.kind !== 'ruby') return visible;
  if (sliceStart !== segmentStart) return visible;
  if (sliceEnd !== segmentEnd) return visible;
  return `${visible}[${segment.reading ?? ''}]`;
};

const sliceRubyText = (value: RubyMarkup, start: TextIndex, end: TextIndex) => {
  let offset = 0;

  return parseRubySegments(value)
    .map((segment) => {
      const plain = (segment.kind === 'ruby' ? segment.base : segment.text) ?? '';
      const segmentStart = offset;
      offset += plain.length;
      return renderSegmentSlice(segment, segmentStart, start, end);
    })
    .join('');
};

const toMaskedRubyText = (
  displayText: DisplayText,
  restoredText: PresentationText,
  restoredTextReading: PresentationText
) => {
  if (!restoredText || !restoredTextReading) return displayText;

  const alignedReading = alignRubyTextToPlainText(restoredTextReading, restoredText);
  if (!alignedReading) return displayText;

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

type Presentation = NonNullable<ReturnType<typeof getStudyCardPresentation>>;

interface ClozePromptModel {
  displayText: string;
  hint: string;
  imageAlt: string;
  imageUrl: string | null;
}

const legacyClozePromptModel = (card: StudyCardSummary): ClozePromptModel => {
  const rawDisplayText = card.prompt.clozeDisplayText ?? null;
  const derived = deriveClozePresentation(card.prompt.clozeText ?? rawDisplayText);
  const fallbackDisplayText =
    rawDisplayText && !CLOZE_MARKUP_PATTERN.test(rawDisplayText)
      ? rawDisplayText
      : derived.displayText;

  return {
    displayText: toMaskedRubyText(
      fallbackDisplayText ?? '',
      card.answer.restoredText ?? derived.restoredText,
      card.answer.restoredTextReading
    ),
    hint: card.prompt.clozeHint?.trim() || card.prompt.clozeResolvedHint?.trim() || '',
    imageAlt: card.prompt.cueMeaning ?? 'Study prompt',
    imageUrl: toAssetUrl(card.prompt.cueImage?.url),
  };
};

const presentationClozePromptModel = (presentation: Presentation): ClozePromptModel => {
  const hint = firstNonBlankPresentationText(presentation.front.hint) ?? '';
  return {
    displayText:
      firstNonBlankPresentationText(presentation.front.ruby, presentation.front.text) ?? '',
    hint,
    imageAlt: hint || 'Study prompt',
    imageUrl: toAssetUrl(presentation.front.media.image?.url),
  };
};

const clozePromptModel = (card: StudyCardSummary, presentation: Presentation | null) =>
  presentation ? presentationClozePromptModel(presentation) : legacyClozePromptModel(card);

const ClozeImage = ({
  compactMobile,
  model,
}: {
  compactMobile: boolean;
  model: ClozePromptModel;
}) => {
  if (!model.imageUrl) return null;
  return (
    <img
      src={model.imageUrl}
      alt={model.imageAlt}
      className={`mx-auto object-contain ${compactMobile ? 'max-h-[46dvh] rounded-lg' : 'max-h-[50dvh] rounded-xl'}`}
    />
  );
};

const ClozeHint = ({ compactMobile, hint }: { compactMobile: boolean; hint: string }) => {
  if (!hint) return null;
  return (
    <p
      className={
        compactMobile
          ? 'pb-1 text-base leading-snug text-gray-700 sm:text-2xl md:text-3xl'
          : 'pb-1 text-xl leading-snug text-gray-700 sm:text-2xl md:text-3xl'
      }
    >
      {toDisplayText(hint)}
    </p>
  );
};

const ClozePrompt = ({
  card,
  compactMobile,
  presentation,
}: {
  card: StudyCardSummary;
  compactMobile: boolean;
  presentation: Presentation | null;
}) => {
  const model = clozePromptModel(card, presentation);

  return (
    <div
      className={
        compactMobile ? 'space-y-3 text-center md:space-y-6' : 'space-y-4 text-center sm:space-y-6'
      }
    >
      <ClozeImage compactMobile={compactMobile} model={model} />
      <StudyRubyText
        as="p"
        text={model.displayText}
        testId="study-cloze-prompt"
        className={`mx-auto max-w-5xl leading-relaxed text-black ${compactMobile ? 'text-2xl sm:text-4xl md:text-6xl' : 'text-3xl sm:text-4xl md:text-6xl'}`}
        rtClassName="text-[0.34em] font-medium text-gray-500"
      />
      <ClozeHint compactMobile={compactMobile} hint={model.hint} />
    </div>
  );
};

interface PromptMedia {
  audio: Presentation['front']['media']['audio'] | StudyCardSummary['prompt']['cueAudio'];
  audioUrl: string | null;
  displayText: string | null | undefined;
  headlineText: string | null;
  hint: string | null | undefined;
  imageUrl: string | null;
  ruby: string | null;
}

const headlineText = (text: PresentationText, displayText: PresentationText) =>
  text ?? (displayText ? toRubyPlainText(displayText) : null);

const presentationPromptMedia = (presentation: Presentation): PromptMedia => {
  const { audio } = presentation.front.media;
  const text = firstNonBlankPresentationText(presentation.front.text);
  const ruby = firstNonBlankPresentationText(presentation.front.ruby);
  const displayText = firstNonBlankPresentationText(ruby, text);
  return {
    audio,
    audioUrl: toAssetUrl(audio?.url),
    displayText,
    headlineText: headlineText(text, displayText),
    hint: firstNonBlankPresentationText(presentation.front.hint),
    imageUrl: toAssetUrl(presentation.front.media.image?.url),
    ruby,
  };
};

const legacyPromptMedia = (card: StudyCardSummary): PromptMedia => ({
  audio: card.prompt.cueAudio,
  audioUrl: toAssetUrl(card.prompt.cueAudio?.url),
  displayText: card.prompt.cueText,
  headlineText: headlineText(card.prompt.cueText, card.prompt.cueText),
  hint: card.prompt.cueMeaning,
  imageUrl: toAssetUrl(card.prompt.cueImage?.url),
  ruby: null,
});

const promptMedia = (card: StudyCardSummary, presentation: Presentation | null): PromptMedia =>
  presentation ? presentationPromptMedia(presentation) : legacyPromptMedia(card);

const isVisualProductionCueLabel = (value: PresentationText) =>
  Boolean(value && STUDY_CANDIDATE_VISUAL_POS_LABELS.has(value));

const MediaPromptImage = ({
  compactMobile,
  imageUrl,
}: {
  compactMobile: boolean;
  imageUrl: string | null;
}) => {
  if (!imageUrl) return null;
  return (
    <img
      src={imageUrl}
      alt="Study prompt"
      className={`mx-auto w-auto max-w-full object-contain ${compactMobile ? 'max-h-[52dvh]' : 'max-h-[56dvh]'}`}
    />
  );
};

const MediaPromptAudio = ({
  audioLed,
  media,
  promptAudioRef,
}: {
  audioLed: boolean;
  media: PromptMedia;
  promptAudioRef?: Ref<AudioPlayerHandle>;
}) => {
  if (!media.audioUrl) return null;
  return (
    <div className={media.imageUrl ? 'pt-2' : ''}>
      <StudyAudioPlayer
        ref={promptAudioRef}
        filename={media.audio?.filename}
        url={media.audioUrl}
        label={audioLed ? 'Replay prompt audio' : 'Play prompt audio'}
        testId="study-prompt-audio"
      />
    </div>
  );
};

const shouldShowMediaHint = (media: PromptMedia, presentation: Presentation | null) => {
  if (!media.imageUrl) return false;
  if (media.audioUrl) return false;
  return presentation ? Boolean(media.hint) : isVisualProductionCueLabel(media.hint);
};

const MediaPromptHint = ({
  compactMobile,
  media,
  presentation,
}: {
  compactMobile: boolean;
  media: PromptMedia;
  presentation: Presentation | null;
}) => {
  if (!shouldShowMediaHint(media, presentation)) return null;
  return (
    <p
      className={`font-semibold text-gray-700 ${compactMobile ? 'text-base sm:text-xl' : 'text-lg sm:text-2xl'}`}
    >
      {toDisplayText(media.hint)}
    </p>
  );
};

const MediaPrompt = ({
  audioLed,
  compactMobile,
  media,
  presentation,
  promptAudioRef,
}: {
  audioLed: boolean;
  compactMobile: boolean;
  media: PromptMedia;
  presentation: Presentation | null;
  promptAudioRef?: Ref<AudioPlayerHandle>;
}) => (
  <div
    className={`flex flex-col items-center justify-center text-center sm:min-h-[58vh] sm:gap-8 ${compactMobile ? 'min-h-[calc(100dvh-12rem)] gap-4' : 'min-h-[calc(100dvh-14rem)] gap-5'}`}
  >
    <MediaPromptImage compactMobile={compactMobile} imageUrl={media.imageUrl} />
    <MediaPromptAudio audioLed={audioLed} media={media} promptAudioRef={promptAudioRef} />
    <MediaPromptHint compactMobile={compactMobile} media={media} presentation={presentation} />
  </div>
);

const TextPrompt = ({
  card,
  compactMobile,
  media,
  presentation,
  promptAudioRef,
}: {
  card: StudyCardSummary;
  compactMobile: boolean;
  media: PromptMedia;
  presentation: Presentation | null;
  promptAudioRef?: Ref<AudioPlayerHandle>;
}) => (
  <div
    className={
      compactMobile ? 'space-y-4 text-center md:space-y-8' : 'space-y-5 text-center sm:space-y-8'
    }
  >
    {media.imageUrl ? (
      <img
        src={media.imageUrl}
        alt={media.hint ?? 'Study prompt'}
        className={`mx-auto object-contain ${compactMobile ? 'max-h-[46dvh] rounded-lg' : 'max-h-[50dvh] rounded-xl'}`}
      />
    ) : null}
    {media.audioUrl ? (
      <StudyAudioPlayer
        ref={promptAudioRef}
        filename={media.audio?.filename}
        url={media.audioUrl}
        label="Play prompt audio"
      />
    ) : null}
    {media.displayText ? (
      <StudyRubyText
        as="div"
        text={
          presentation
            ? media.displayText
            : (media.ruby ??
              matchingRubyText(media.displayText, [
                card.prompt.cueReading,
                card.answer.expressionReading,
              ]) ??
              media.displayText)
        }
        testId="study-front-heading"
        autoFitSingleLine
        minFontSizePx={compactMobile ? 24 : 28}
        className={`mx-auto w-full max-w-full min-w-0 whitespace-normal break-words text-center font-semibold leading-tight text-black md:max-w-5xl md:whitespace-nowrap ${getHeadlineClasses(media.headlineText, { compactMobile })}`}
        rtClassName="text-[0.34em] font-medium text-gray-500"
      />
    ) : null}
    {media.hint ? (
      <p
        className={`mx-auto max-w-3xl text-gray-700 sm:text-xl md:text-2xl ${compactMobile ? 'text-base' : 'text-lg'}`}
      >
        {toDisplayText(media.hint)}
      </p>
    ) : null}
  </div>
);

const StudyCardFront = ({
  card,
  compactMobile,
  promptAudioRef,
}: {
  card: StudyCardSummary;
  compactMobile: boolean;
  promptAudioRef?: Ref<AudioPlayerHandle>;
}) => {
  const presentation = getStudyCardPresentation(card);
  const isCloze = presentation ? presentation.front.mode === 'cloze' : card.cardType === 'cloze';
  if (isCloze) {
    return <ClozePrompt card={card} compactMobile={compactMobile} presentation={presentation} />;
  }

  const media = promptMedia(card, presentation);
  if (isMediaLedPromptCard(card)) {
    return (
      <MediaPrompt
        audioLed={isAudioLedPromptCard(card)}
        compactMobile={compactMobile}
        media={media}
        presentation={presentation}
        promptAudioRef={promptAudioRef}
      />
    );
  }

  return (
    <TextPrompt
      card={card}
      compactMobile={compactMobile}
      media={media}
      presentation={presentation}
      promptAudioRef={promptAudioRef}
    />
  );
};

export default StudyCardFront;
