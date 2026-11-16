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
  rows = 3,
  ...props
}: Props) => (
  <div className={`journal-writing-field ${className}`} style={style}>
    <div aria-hidden="true" className="journal-writing-field-size">
      {`${value} `}
    </div>
    <textarea {...props} ref={fieldRef} value={value} rows={rows} />
  </div>
);

export default JournalWritingField;
