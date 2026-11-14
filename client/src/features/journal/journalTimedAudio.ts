import { requestJson } from '../../lib/apiClient';

export interface SentenceTiming {
  text: string;
  start: number;
  end: number;
}
export interface TimedRecording {
  audioBase64: string;
  sentences: SentenceTiming[];
}
export const timedEntryAudio = (
  entryId: string,
  body: { analysisId: string; voiceId: string; expectedReplyRevision: number },
  signal: AbortSignal
) =>
  requestJson<{ data: TimedRecording }>(
    `/api/journal/entries/${encodeURIComponent(entryId)}/audio/timed`,
    {
      method: 'POST',
      body: JSON.stringify(body),
      signal,
    }
  );
export const timedQuestionAudio = (entryId: string, questionId: string, signal: AbortSignal) =>
  requestJson<{ data: TimedRecording }>(
    `/api/journal/entries/${encodeURIComponent(entryId)}/questions/${encodeURIComponent(questionId)}/audio/timed`,
    { method: 'POST', signal }
  );

export function recordingBlob(recording: TimedRecording) {
  const bytes = Uint8Array.from(atob(recording.audioBase64), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: 'audio/mpeg' });
}

export function sentenceAt(sentences: SentenceTiming[], position: number) {
  // Media clocks can round a requested seek a fraction below the boundary.
  return sentences.reduce(
    (current, sentence, index) =>
      position + 0.001 >= sentence.start && position < sentence.end ? index : current,
    -1
  );
}

export function adjacentSentence(sentences: SentenceTiming[], position: number, direction: number) {
  if (!sentences.length) return undefined;
  const current = sentences.reduce(
    (index, sentence, next) => (position + 0.001 >= sentence.start ? next : index),
    0
  );
  return sentences[Math.max(0, Math.min(sentences.length - 1, current + direction))].start;
}
