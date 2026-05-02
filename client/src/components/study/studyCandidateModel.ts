import type {
  StudyCardCandidate,
  StudyCardCandidateCommitItem,
  StudyCardSummary,
  StudyMediaRef,
} from '@languageflow/shared/src/types';

import { buildStudyCardFormPayload, type StudyCardFormValues } from './studyCardFormModel';

export interface StudyCandidateDraft {
  candidate: StudyCardCandidate;
  selected: boolean;
  values: StudyCardFormValues;
  previewAudio: StudyMediaRef | null;
  previewAudioRole: 'prompt' | 'answer' | null;
  previewImage: StudyMediaRef | null;
  imagePrompt: string;
}

export const STUDY_CANDIDATE_AUDIO_AFFECTING_FIELDS = new Set<keyof StudyCardFormValues>([
  'answerExpression',
  'answerReading',
  'answerAudioVoiceId',
  'answerAudioTextOverride',
]);

export function normalizeCandidateImagePrompt(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

export function hasVisualProductionPreview(draft: StudyCandidateDraft): boolean {
  return (
    draft.candidate.candidateKind === 'production' &&
    (draft.imagePrompt.trim().length > 0 || draft.previewImage !== null)
  );
}

export function studyCandidateToFormValues(candidate: StudyCardCandidate): StudyCardFormValues {
  if (candidate.cardType === 'cloze') {
    return {
      cardType: 'cloze',
      cueText: candidate.prompt.clozeText ?? '',
      cueReading: '',
      cueMeaning: candidate.prompt.clozeHint ?? candidate.prompt.clozeResolvedHint ?? '',
      answerExpression: candidate.answer.restoredText ?? '',
      answerReading: candidate.answer.restoredTextReading ?? '',
      answerMeaning: candidate.answer.meaning ?? '',
      answerAudioVoiceId: candidate.answer.answerAudioVoiceId ?? '',
      answerAudioTextOverride: candidate.answer.answerAudioTextOverride ?? '',
      notes: candidate.answer.notes ?? '',
      sentenceJp: '',
      sentenceEn: '',
    };
  }

  return {
    cardType: candidate.cardType,
    cueText: candidate.prompt.cueText ?? '',
    cueReading: candidate.prompt.cueReading ?? '',
    cueMeaning: candidate.prompt.cueMeaning ?? '',
    answerExpression: candidate.answer.expression ?? '',
    answerReading: candidate.answer.expressionReading ?? '',
    answerMeaning: candidate.answer.meaning ?? '',
    answerAudioVoiceId: candidate.answer.answerAudioVoiceId ?? '',
    answerAudioTextOverride: candidate.answer.answerAudioTextOverride ?? '',
    notes: candidate.answer.notes ?? '',
    sentenceJp: candidate.answer.sentenceJp ?? '',
    sentenceEn: candidate.answer.sentenceEn ?? '',
  };
}

export function createStudyCandidateDraft(candidate: StudyCardCandidate): StudyCandidateDraft {
  return {
    candidate,
    selected: true,
    values: studyCandidateToFormValues(candidate),
    previewAudio: candidate.previewAudio ?? null,
    previewAudioRole: candidate.previewAudioRole ?? null,
    previewImage: candidate.previewImage ?? candidate.prompt.cueImage ?? null,
    imagePrompt: candidate.imagePrompt ?? '',
  };
}

export function buildStudyCandidateCommitItem(
  draft: StudyCandidateDraft
): StudyCardCandidateCommitItem {
  const payload = buildStudyCardFormPayload(draft.values);
  const prompt =
    draft.candidate.candidateKind === 'audio-recognition'
      ? {
          cueAudio: draft.previewAudio ?? draft.candidate.prompt.cueAudio ?? null,
        }
      : {
          ...payload.prompt,
          // Visual production prompts use the generated image as the cue, so suppress
          // any residual text cue when an image is selected.
          ...(draft.previewImage ? { cueText: null, cueImage: draft.previewImage } : {}),
        };
  return {
    clientId: draft.candidate.clientId,
    candidateKind: draft.candidate.candidateKind,
    cardType: draft.candidate.cardType,
    prompt,
    answer: payload.answer,
    previewAudio: draft.previewAudio,
    previewAudioRole: draft.previewAudioRole,
    previewImage: draft.previewImage,
    imagePrompt: normalizeCandidateImagePrompt(draft.imagePrompt),
  };
}

export function buildStudyCandidatePreviewCard(
  draft: StudyCandidateDraft,
  candidate: StudyCardCandidateCommitItem
): StudyCardSummary {
  const previewPrompt =
    candidate.previewAudioRole === 'prompt' && candidate.previewAudio
      ? { ...candidate.prompt, cueAudio: candidate.previewAudio }
      : candidate.prompt;
  const previewAnswer =
    candidate.previewAudioRole === 'answer' && candidate.previewAudio
      ? { ...candidate.answer, answerAudio: candidate.previewAudio }
      : candidate.answer;

  return {
    id: `candidate-preview-${draft.candidate.clientId}`,
    noteId: `candidate-preview-note-${draft.candidate.clientId}`,
    cardType: candidate.cardType,
    prompt: previewPrompt,
    answer: previewAnswer,
    answerAudioSource: 'generated',
    createdAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '1970-01-01T00:00:00.000Z',
    state: {
      dueAt: null,
      introducedAt: null,
      queueState: 'new',
      scheduler: null,
      source: {},
    },
  };
}
