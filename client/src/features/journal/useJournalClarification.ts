import { useCallback, useEffect, useRef, useState } from 'react';
import pollClarification from './journalClarificationPolling';
import {
  answerClarification,
  startClarification,
  type ClarificationEntry,
  type JournalClarification,
} from './journalClarification';

interface Session {
  entry: ClarificationEntry;
  controller: AbortController;
  resolve: (id: string | undefined) => void;
  promise: Promise<string | undefined>;
}
export default function useJournalClarification(scope: string) {
  const session = useRef<Session | null>(null);
  const running = useRef(false);
  const [active, setActive] = useState(false);
  const [state, setState] = useState<JournalClarification | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const cancel = useCallback(() => {
    session.current?.controller.abort();
    session.current?.resolve(undefined);
    session.current = null;
    running.current = false;
    setActive(false);
    setState(null);
    setBusy(false);
    setError('');
  }, []);
  useEffect(() => cancel, [scope, cancel]);

  async function receive(current: Session, first: JournalClarification) {
    const next = await pollClarification(current.entry, first, current.controller.signal, setState);
    if (next.status === 'resolved') {
      current.resolve(next.id);
      session.current = null;
      setActive(false);
      setState(null);
    }
  }
  async function request(operation: (current: Session) => Promise<JournalClarification>) {
    const { current } = session;
    if (!current || running.current) return;
    running.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await operation(current);
      if (!current.controller.signal.aborted) await receive(current, result);
    } catch (reason) {
      if (!current.controller.signal.aborted)
        setError(reason instanceof Error ? reason.message : 'Please retry.');
    } finally {
      if (!current.controller.signal.aborted) {
        running.current = false;
        setBusy(false);
      }
    }
  }
  function begin(entry: ClarificationEntry) {
    if (session.current) return session.current.promise;
    let resolve: Session['resolve'] = () => undefined;
    const promise = new Promise<string | undefined>((done) => {
      resolve = done;
    });
    session.current = { entry, controller: new AbortController(), resolve, promise };
    setActive(true);
    setState(null);
    request((current) => startClarification(current.entry, current.controller.signal)).catch(
      () => undefined
    );
    return promise;
  }
  function answer(text: string) {
    if (!state?.question || !text.trim()) return Promise.resolve();
    return request((current) =>
      answerClarification(current.entry, state, text.trim(), current.controller.signal)
    );
  }
  function retry() {
    return request((current) => startClarification(current.entry, current.controller.signal));
  }
  return { active, state, busy, error, begin, answer, retry, cancel };
}
