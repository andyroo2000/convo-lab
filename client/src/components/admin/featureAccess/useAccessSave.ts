import { useRef, useState } from 'react';
import { message } from './api';

export default function useAccessSave() {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run<T>(save: () => Promise<T>, done: (value: T) => void) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      done(await save());
    } catch (cause) {
      setError(message(cause));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return { busy, error, run };
}
