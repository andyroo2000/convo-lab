import useLearnDraft from './useLearnDraft';
import type { LearnAction } from './types';

interface Props {
  storageKey: string;
  busy: boolean;
  busyLabel?: string;
  onSend: (action: LearnAction, text?: string) => Promise<unknown>;
}
const LearnComposer = ({
  storageKey,
  busy,
  busyLabel = 'Your tutor is thinking…',
  onSend,
}: Props) => {
  const { text, setText } = useLearnDraft(storageKey);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim() || busy) return;
    try {
      await onSend('message', text);
      setText('');
    } catch {
      /* Keep the answer and display the request error in the lesson. */
    }
  };
  return (
    <form className="learn-composer" onSubmit={submit}>
      <label htmlFor="learn-response">
        <span className="sr-only">Your reply</span>
        <textarea
          id="learn-response"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          maxLength={3000}
          disabled={busy}
          placeholder="Answer or ask a question…"
        />
      </label>
      <div className="learn-composer-footer">
        <button className="learn-button" disabled={busy || !text.trim()} type="submit">
          {busy ? busyLabel : 'Send'}
        </button>
      </div>
    </form>
  );
};

export default LearnComposer;
