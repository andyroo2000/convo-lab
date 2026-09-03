import { parseRubySegments } from './studyTextUtils';

const toRubyPlainText = (value: string) =>
  parseRubySegments(value)
    .map((segment) => (segment.kind === 'ruby' ? segment.base : segment.text) ?? '')
    .join('');

export default toRubyPlainText;
