import {
  useImperativeHandle,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentPropsWithoutRef,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';
import useJournalKeyboard from './useJournalKeyboard';
import JournalKeyboardDialog from './JournalKeyboardDialog';
import JournalKeyboardStatus from './JournalKeyboardStatus';
import './journalWritingField.css';
import './journalKeyboard.css';

type Props = Omit<ComponentPropsWithoutRef<'textarea'>, 'value'> & {
  value: string;
  fieldRef?: Ref<HTMLTextAreaElement>;
};

function inputAssistance(builtIn: boolean, props: ComponentPropsWithoutRef<'textarea'>) {
  if (builtIn) return { autoCorrect: 'off', autoCapitalize: 'off', spellCheck: false };
  return {
    autoCorrect: props.autoCorrect,
    autoCapitalize: props.autoCapitalize,
    spellCheck: props.spellCheck,
  };
}

function useWritingEvents(onChange: Props['onChange'], onInput: Props['onInput']) {
  const handled = useRef(new WeakSet<Event>());
  const change: NonNullable<Props['onChange']> = (event) => {
    if (handled.current.has(event.nativeEvent)) return;
    handled.current.add(event.nativeEvent);
    onChange?.(event);
  };
  const input: Props['onInput'] = (event) => {
    // Runtime value assignments can bypass React's change tracking. Forward them,
    // but share the native-event guard with onChange to avoid duplicate saves.
    if (!(event.nativeEvent instanceof InputEvent))
      change(event as ChangeEvent<HTMLTextAreaElement>);
    onInput?.(event);
  };
  return { change, input };
}

function useFirstKeyboardChoice(ask: boolean, onFocus: Props['onFocus']) {
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  const focus: Props['onFocus'] = (event) => {
    onFocus?.(event);
    if (ask) setOpener(event.currentTarget);
  };
  return { opener, focus, close: () => setOpener(null) };
}

const JournalWritingField = ({
  value,
  fieldRef,
  className = '',
  style,
  lang,
  rows = 3,
  onChange,
  onInput,
  onFocus,
  disabled = false,
  readOnly = false,
  ...props
}: Props) => {
  const field = useRef<HTMLTextAreaElement | null>(null);
  const list = useRef<HTMLDivElement | null>(null);
  useImperativeHandle(fieldRef, () => field.current as HTMLTextAreaElement);
  const events = useWritingEvents(onChange, onInput);
  const keyboard = useJournalKeyboard(field, list, disabled || readOnly);
  const onboarding = useFirstKeyboardChoice(!keyboard.mode && !readOnly, onFocus);
  const preparing = keyboard.mode === 'built-in' && keyboard.state !== 'ready';
  return (
    <>
      <div className={`journal-writing-field ${className}`} style={style} lang={lang}>
        <span aria-hidden="true" className="journal-writing-field-size">
          {`${value} `}
        </span>
        <textarea
          {...props}
          ref={field}
          value={value}
          rows={rows}
          disabled={disabled}
          readOnly={readOnly || preparing}
          {...inputAssistance(keyboard.mode === 'built-in', props)}
          onChange={events.change}
          onInput={events.input}
          onFocus={onboarding.focus}
        />
      </div>
      {preparing && !disabled && !readOnly && (
        <JournalKeyboardStatus state={keyboard.state} retry={keyboard.retry} />
      )}
      {onboarding.opener && (
        <JournalKeyboardDialog opener={onboarding.opener} onClose={onboarding.close} />
      )}
      {createPortal(
        <div
          ref={list}
          className="journal-kanji-candidates"
          aria-label="Japanese conversion choices"
          hidden
        />,
        document.body
      )}
    </>
  );
};

export default JournalWritingField;
