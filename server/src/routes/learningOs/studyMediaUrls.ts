export const STUDY_ULID_SEGMENT = '[0-9A-HJKMNP-TV-Z]{26}';
const LEARNING_OS_STUDY_MEDIA_PATH = new RegExp(`^/api/study/media/(${STUDY_ULID_SEGMENT})$`, 'i');

export function rewriteLearningOsStudyMediaUrl(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const match = value.match(LEARNING_OS_STUDY_MEDIA_PATH);
  if (!match?.[1]) {
    return value;
  }

  return `/api/learning-os/study/media/${match[1].toUpperCase()}`;
}

function rewriteMediaReference(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value;
  }

  const media = value as Record<string, unknown>;
  if (typeof media.url !== 'string') {
    return value;
  }

  const url = rewriteLearningOsStudyMediaUrl(media.url);
  return url === media.url ? value : { ...media, url };
}

function rewritePayloadMedia(value: unknown, mediaFields: readonly string[]): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value;
  }

  const payload = value as Record<string, unknown>;
  let changed = false;
  const rewritten = { ...payload };

  for (const field of mediaFields) {
    if (!(field in payload)) {
      continue;
    }

    const media = rewriteMediaReference(payload[field]);
    if (media !== payload[field]) {
      rewritten[field] = media;
      changed = true;
    }
  }

  return changed ? rewritten : value;
}

export function rewriteStudyCardMediaUrls(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value;
  }

  const card = value as Record<string, unknown>;
  const prompt = rewritePayloadMedia(card.prompt, ['cueAudio', 'cueImage']);
  const answer = rewritePayloadMedia(card.answer, ['answerAudio', 'answerImage']);

  return prompt === card.prompt && answer === card.answer ? value : { ...card, prompt, answer };
}

export function rewriteStudyCardDraftMediaUrls(value: unknown): unknown {
  const card = rewriteStudyCardMediaUrls(value);
  if (typeof card !== 'object' || card === null || Array.isArray(card)) {
    return card;
  }

  const draft = card as Record<string, unknown>;
  const previewAudio = rewriteMediaReference(draft.previewAudio);
  const previewImage = rewriteMediaReference(draft.previewImage);

  return previewAudio === draft.previewAudio && previewImage === draft.previewImage
    ? card
    : { ...draft, previewAudio, previewImage };
}
