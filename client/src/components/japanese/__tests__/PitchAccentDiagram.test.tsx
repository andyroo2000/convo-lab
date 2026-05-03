import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import PitchAccentDiagram from '../PitchAccentDiagram';

const resolvedPitchAccent = {
  status: 'resolved' as const,
  expression: '中学校',
  reading: 'ちゅうがっこう',
  pitchNum: 3,
  morae: ['ちゅ', 'う', 'が', 'っ', 'こ', 'う'],
  pattern: [0, 1, 1, 0, 0, 0],
  patternName: '中高',
  source: 'kanjium' as const,
  resolvedBy: 'local-reading' as const,
};

describe('PitchAccentDiagram', () => {
  it('renders mora labels and an accessible SVG diagram', () => {
    render(<PitchAccentDiagram pitchAccent={resolvedPitchAccent} />);

    expect(screen.getByRole('img')).toHaveAccessibleName('Pitch accent for 中学校, ちゅうがっこう');
    Array.from(new Set(resolvedPitchAccent.morae)).forEach((mora) => {
      expect(screen.getAllByText(mora).length).toBeGreaterThan(0);
    });
  });

  it('renders high-low path segments including a downstep', () => {
    render(<PitchAccentDiagram pitchAccent={resolvedPitchAccent} />);

    expect(screen.getAllByTestId('pitch-accent-segment').length).toBeGreaterThan(1);
    expect(screen.getByTestId('pitch-accent-downstep')).toBeInTheDocument();
  });

  it('renders nothing for unresolved pitch accent data', () => {
    const { container } = render(
      <PitchAccentDiagram
        pitchAccent={{
          status: 'unresolved',
          expression: '日本',
          reason: 'ambiguous-reading',
          source: 'kanjium',
          resolvedBy: 'llm',
        }}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
