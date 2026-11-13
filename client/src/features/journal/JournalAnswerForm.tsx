import { journalTextStyle } from './journalTypography';
import type useJournalReplies from './useJournalReplies';

type Reply = ReturnType<typeof useJournalReplies>;
const JournalAnswerActions = ({ reply, disabled }: { reply: Reply; disabled: boolean }) => {
  const submitLabel = reply.draft.replace ? 'Update answer' : 'Add to entry';
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        className="btn-primary"
        disabled={disabled || !reply.draft.answer.trim()}
        onClick={() => {
          reply.submit().catch(() => undefined);
        }}
      >
        {disabled ? 'Adding…' : submitLabel}
      </button>
      {reply.draft.replace && (
        <button
          type="button"
          disabled={disabled || reply.waiting}
          className="text-sm text-indigo"
          onClick={reply.cancelEdit}
        >
          Cancel
        </button>
      )}
    </div>
  );
};

const JournalAnswerForm = ({ reply }: { reply: Reply }) => {
  const disabled = reply.busy || reply.processing;
  return (
    <>
      <label htmlFor="journal-answer" className="block space-y-2">
        <span className="text-sm text-gray-600">
          {reply.draft.replace ? 'Edit your last answer' : 'Your answer (optional)'}
        </span>
        <textarea
          style={journalTextStyle}
          id="journal-answer"
          value={reply.draft.answer}
          onChange={(event) => reply.change(event.target.value)}
          disabled={disabled || reply.waiting}
          maxLength={5000}
          rows={4}
          lang="ja"
          className="w-full rounded-xl border border-gray-200 p-3 text-xl leading-loose focus:ring-2 focus:ring-indigo/30"
        />
      </label>
      {reply.error && (
        <p role="alert" className="text-sm text-rose-700">
          {reply.error}
        </p>
      )}
      <JournalAnswerActions reply={reply} disabled={disabled} />
    </>
  );
};

export default JournalAnswerForm;
