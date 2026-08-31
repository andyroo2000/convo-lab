import type { StudyCardSummary } from '@languageflow/shared/src/types';

import { API_URL } from '../../config';
import { DAILY_AUDIO_API_BASE, STUDY_API_BASE } from '../../lib/studyApi';

export const getStudyCardPresentation = (card: StudyCardSummary) =>
  card.presentation?.version === 1 ? card.presentation : null;

export const toAssetUrl = (url?: string | null) => {
  if (!url) return null;
  if (
    [STUDY_API_BASE, DAILY_AUDIO_API_BASE].some(
      (base) => url === base || url.startsWith(`${base}/`)
    )
  ) {
    return url;
  }
  return url.startsWith('/') ? `${API_URL}${url}` : url;
};

export const getAudioMimeType = (url?: string | null, filename?: string | null) => {
  const target = (filename ?? url ?? '').toLowerCase();

  if (target.endsWith('.aac')) return 'audio/aac';
  if (target.endsWith('.flac')) return 'audio/flac';
  if (target.endsWith('.m4a')) return 'audio/mp4';
  if (target.endsWith('.wav')) return 'audio/wav';
  if (target.endsWith('.oga') || target.endsWith('.ogg')) return 'audio/ogg';
  if (target.endsWith('.opus')) return 'audio/opus';
  if (target.endsWith('.weba')) return 'audio/webm';
  return 'audio/mpeg';
};

/**
 * Resolve the card's one logical audio asset from the legacy side-specific fields.
 * Prompt audio wins when both fields are present because it is the recognition cue;
 * answerAudio remains readable for cards created before audio-led prompts existed.
 */
export const getStudyCardAudio = (card: StudyCardSummary) =>
  card.prompt.cueAudio ?? card.answer.answerAudio ?? null;

export const getStudyCardReviewAudio = (card: StudyCardSummary) => {
  const presentation = getStudyCardPresentation(card);
  return presentation ? presentation.answer.audio : getStudyCardAudio(card);
};

export const getStudyCardAudioUrl = (card: StudyCardSummary) =>
  toAssetUrl(getStudyCardReviewAudio(card)?.url);

export const isAudioLedPromptCard = (card: StudyCardSummary) =>
  getStudyCardPresentation(card)?.front.autoplayAudio ??
  Boolean(
    card.cardType === 'recognition' &&
    card.prompt.cueAudio &&
    !card.prompt.cueText &&
    !card.prompt.cueMeaning &&
    !card.prompt.clozeText
  );

export const isMediaLedPromptCard = (card: StudyCardSummary) => {
  const presentation = getStudyCardPresentation(card);
  return presentation
    ? presentation.front.mode === 'media'
    : Boolean(
        (card.prompt.cueAudio?.url || card.prompt.cueImage?.url) &&
        !card.prompt.cueText &&
        !card.prompt.clozeText
      );
};
