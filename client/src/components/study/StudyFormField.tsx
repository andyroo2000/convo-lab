import type { ReactNode } from 'react';

interface StudyFormFieldProps {
  children: ReactNode;
  className?: string;
  htmlFor: string;
  label: string;
}

const StudyFormField = ({ children, className, htmlFor, label }: StudyFormFieldProps) => (
  <div className={className}>
    <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-gray-700">
      {label}
    </label>
    {children}
  </div>
);

export default StudyFormField;
