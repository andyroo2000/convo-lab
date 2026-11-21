import { useEffect, useState, type RefObject } from 'react';
import { loadKeyboard, type KeyboardRuntime } from './journalKeyboardRuntime';
import { useKeyboardMode } from './journalKeyboardPreference';

type Fields = {
  field: RefObject<HTMLTextAreaElement | null>;
  list: RefObject<HTMLDivElement | null>;
};
type Lifetime = {
  cancelled: boolean;
  timer?: ReturnType<typeof setTimeout>;
  attached?: { dispose: () => void };
};

function updateAttachment(
  runtime: KeyboardRuntime,
  fields: Fields,
  lifetime: Lifetime,
  current: string
) {
  if (current === 'ready' && !lifetime.attached) {
    const { field, list } = fields;
    if (field.current && list.current)
      Object.assign(lifetime, { attached: runtime.attach(field.current, list.current) });
  }
  if (current !== 'ready') {
    lifetime.attached?.dispose();
    Object.assign(lifetime, { attached: undefined });
  }
}

function poll(
  runtime: KeyboardRuntime,
  fields: Fields,
  lifetime: Lifetime,
  notify: (state: string) => void
) {
  if (lifetime.cancelled) return;
  const current = runtime.readiness().state;
  notify(current);
  updateAttachment(runtime, fields, lifetime, current);
  if (current !== 'error') {
    Object.assign(lifetime, {
      timer: setTimeout(
        () => poll(runtime, fields, lifetime, notify),
        current === 'ready' ? 1000 : 200
      ),
    });
  }
}

function connect(fields: Fields, notify: (state: string) => void, retry: boolean) {
  const lifetime: Lifetime = { cancelled: false };
  notify('loading');
  loadKeyboard()
    .then(async (runtime) => {
      if (lifetime.cancelled) return;
      if (retry && runtime.readiness().state === 'error') await runtime.retry();
      poll(runtime, fields, lifetime, notify);
    })
    .catch(() => {
      if (!lifetime.cancelled) notify('error');
    });
  return () => {
    lifetime.cancelled = true;
    clearTimeout(lifetime.timer);
    lifetime.attached?.dispose();
  };
}

export default function useJournalKeyboard(
  field: Fields['field'],
  list: Fields['list'],
  disabled: boolean
) {
  const mode = useKeyboardMode();
  const [state, setState] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (mode !== 'built-in' || disabled) return undefined;
    return connect({ field, list }, setState, attempt > 0);
  }, [mode, disabled, attempt, field, list]);
  useEffect(() => {
    const input = field.current;
    if (mode !== 'built-in' || state !== 'ready' || document.activeElement !== input) return;
    // Chrome can retain the readonly input context after the preparation gate
    // opens. Refresh an already-focused field without scrolling or stealing focus.
    input?.blur();
    input?.focus({ preventScroll: true });
  }, [mode, state, field]);
  return { mode, state, retry: () => setAttempt((value) => value + 1) };
}
