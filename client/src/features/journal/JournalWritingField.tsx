import type { ComponentPropsWithoutRef, Ref } from 'react';
import './journalWritingField.css';

type Props = Omit<ComponentPropsWithoutRef<'textarea'>, 'value'> & {
  value: string;
  fieldRef?: Ref<HTMLTextAreaElement>;
};

const JournalWritingField = ({
  value,
  fieldRef,
  className = '',
  style,
  lang,
  rows = 3,
  ...props
}: Props) => (
  <div className={`journal-writing-field ${className}`} style={style} lang={lang}>
    <span aria-hidden="true" className="journal-writing-field-size">
      {`${value} `}
    </span>
    <textarea {...props} ref={fieldRef} value={value} rows={rows} />
  </div>
);

export default JournalWritingField;
