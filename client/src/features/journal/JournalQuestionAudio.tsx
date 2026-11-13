import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import focusJournalAudio from './journalPlayback';
import { requestJson } from '../../lib/apiClient';
import useQuestionRecording from './useQuestionRecording';
import type { TutorQuestion } from './journalTutor';

interface Props {
  ownerId: string;
  entryId: string;
  question: TutorQuestion;
  prepare: () => Promise<unknown>;
}
const waiting = (question?: TutorQuestion) =>
  ['queued', 'processing'].includes(question?.audio?.status ?? '');
function audioFailure(question: TutorQuestion) {
  const { audio } = question;
  if (!audio) return '';
  if (['ready', 'queued', 'processing'].includes(audio.status)) return '';
  return audio.error || 'Audio could not be prepared.';
}
function useQuestionAudio({ ownerId, entryId, question, prepare }: Props) {
  const [attempt, setAttempt] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState('');
  const state = useQuery({
    queryKey: ['journal-question-audio', ownerId, entryId, question.id],
    queryFn: ({ signal }) =>
      requestJson<{ data: TutorQuestion }>(
        `/api/journal/entries/${encodeURIComponent(entryId)}/questions/${encodeURIComponent(question.id)}`,
        { signal }
      ),
    initialData: { data: question },
    retry: false,
    refetchInterval: (query) => (waiting(query.state.data?.data) ? 2000 : false),
  });
  const { audio } = state.data.data;
  const recording = useQuestionRecording(entryId, question.id, audio?.status === 'ready', attempt);
  const error =
    recording.error ||
    audioFailure(state.data.data) ||
    retryError ||
    (state.error ? 'Audio status is unavailable.' : '');
  async function retry() {
    setRetrying(true);
    setRetryError('');
    try {
      await prepare();
      await state.refetch({ throwOnError: true });
      setAttempt((value) => value + 1);
    } catch {
      setRetryError('Audio could not be prepared. Please try again.');
    } finally {
      setRetrying(false);
    }
  }
  return { recording, error, retrying, retry, setRetryError };
}
const JournalQuestionAudio = ({ ownerId, entryId, question, prepare }: Props) => {
  const { recording, error, retrying, retry, setRetryError } = useQuestionAudio({
    ownerId,
    entryId,
    question,
    prepare,
  });
  if (!question.tutor) return null;
  return (
    <div className="mt-3">
      {recording.url && (
        <audio
          data-journal-audio
          onPlay={(event) => focusJournalAudio(event.currentTarget)}
          controls
          preload="metadata"
          src={recording.url}
          aria-label={`${question.tutor.name}'s question`}
          className="h-9 w-full"
          onError={() => setRetryError('Audio could not be played. Please retry.')}
        />
      )}
      {error ? (
        <p role="alert" className="text-sm text-rose-700">
          {error}{' '}
          <button
            type="button"
            className="underline"
            disabled={retrying}
            onClick={() => {
              retry().catch(() => undefined);
            }}
          >
            {retrying ? 'Retrying…' : 'Retry audio'}
          </button>
        </p>
      ) : (
        !recording.url && (
          <p role="status" className="text-xs text-gray-500">
            Preparing question audio…
          </p>
        )
      )}
    </div>
  );
};
const QuestionRecording = ({
  question,
  ownerId,
  entryId,
  prepare,
}: Omit<Props, 'question'> & { question?: TutorQuestion }) => {
  if (!question?.audio) return null;
  return (
    <JournalQuestionAudio
      ownerId={ownerId}
      entryId={entryId}
      prepare={prepare}
      question={question}
      key={question.id}
    />
  );
};
export default QuestionRecording;
