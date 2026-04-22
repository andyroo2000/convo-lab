import { Fragment } from 'react';
import type { ElementType } from 'react';

import { parseRubySegments } from './studyTextUtils';

interface StudyRubyTextProps {
  as?: ElementType;
  className?: string;
  rtClassName?: string;
  text?: string | null;
  testId?: string;
}

const StudyRubyText = ({
  as: Component = 'span',
  className,
  rtClassName,
  text,
  testId,
}: StudyRubyTextProps) => {
  if (!text) {
    return null;
  }

  const segments = parseRubySegments(text);

  return (
    <Component className={className} data-testid={testId}>
      {segments.map((segment) => {
        if (segment.kind === 'text') {
          return <Fragment key={segment.key}>{segment.text}</Fragment>;
        }

        return (
          <ruby key={segment.key} className="study-ruby">
            {segment.base}
            <rt className={rtClassName}>{segment.reading}</rt>
          </ruby>
        );
      })}
    </Component>
  );
};

export default StudyRubyText;
