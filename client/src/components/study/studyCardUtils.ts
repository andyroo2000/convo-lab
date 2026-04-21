import type { StudyCardSummary } from '@shared/types';

import { API_URL } from '../../config';

export const toAssetUrl = (url?: string | null) => {
  if (!url) return null;
  return url.startsWith('/') ? `${API_URL}${url}` : url;
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
