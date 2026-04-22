import type { StudyCardSummary } from '@languageflow/shared/src/types';

import { API_URL } from '../../config';

export const toAssetUrl = (url?: string | null) => {
  if (!url) return null;
  return url.startsWith('/') ? `${API_URL}${url}` : url;
};

export const getAudioMimeType = (url?: string | null, filename?: string | null) => {
  const target = (filename ?? url ?? '').toLowerCase();

  if (target.endsWith('.wav')) return 'audio/wav';
  if (target.endsWith('.ogg')) return 'audio/ogg';
  return 'audio/mpeg';
};

export const isAudioLedPromptCard = (card: StudyCardSummary) =>
  Boolean(
    card.prompt.cueAudio?.url &&
    !card.prompt.cueText &&
    !card.prompt.cueMeaning &&
    !card.prompt.clozeText
  );

export const isMediaLedPromptCard = (card: StudyCardSummary) =>
  Boolean(
    (card.prompt.cueAudio?.url || card.prompt.cueImage?.url) &&
    !card.prompt.cueText &&
    !card.prompt.clozeText
  );
