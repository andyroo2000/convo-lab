import {
  clarificationPending,
  readClarification,
  type ClarificationEntry,
  type JournalClarification,
} from './journalClarification';

function pause(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, 1500);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

export default async function pollClarification(
  entry: ClarificationEntry,
  state: JournalClarification,
  signal: AbortSignal,
  onState: (state: JournalClarification) => void
): Promise<JournalClarification> {
  signal.throwIfAborted();
  if (state.sourceVersion !== entry.version)
    throw new Error('The draft changed. Go back and submit it again.');
  onState(state);
  if (state.status === 'failed')
    throw new Error(state.error ?? 'Could not check your meaning. Please retry.');
  if (!clarificationPending(state)) return state;
  await pause(signal);
  const next = await readClarification(entry, signal);
  return pollClarification(entry, next, signal, onState);
}
