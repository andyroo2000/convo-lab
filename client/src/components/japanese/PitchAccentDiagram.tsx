import type { JapanesePitchAccentPayload } from '@languageflow/shared/src/types';

interface PitchAccentDiagramProps {
  pitchAccent?: JapanesePitchAccentPayload | null;
  className?: string;
}

const COLUMN_WIDTH = 42;
const HEIGHT = 92;
const TOP_Y = 18;
const BOTTOM_Y = 46;
const LABEL_Y = 76;

const getY = (value: number) => (value === 1 ? TOP_Y : BOTTOM_Y);

const PitchAccentDiagram = ({ pitchAccent, className = '' }: PitchAccentDiagramProps) => {
  if (!pitchAccent || pitchAccent.status !== 'resolved') {
    return null;
  }

  const width = Math.max(120, pitchAccent.morae.length * COLUMN_WIDTH);
  const points = pitchAccent.pattern.map((value, index) => ({
    x: COLUMN_WIDTH / 2 + index * COLUMN_WIDTH,
    y: getY(value),
  }));

  return (
    <svg
      role="img"
      aria-label={`Pitch accent for ${pitchAccent.expression}, ${pitchAccent.reading}`}
      className={className}
      viewBox={`0 0 ${width} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid="pitch-accent-diagram"
    >
      {points.slice(0, -1).map((point, index) => {
        const next = points[index + 1];
        const isDownstep = point.y < next.y;
        return (
          <line
            key={`${point.x}-${next.x}`}
            x1={point.x}
            y1={point.y}
            x2={next.x}
            y2={next.y}
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            data-testid={isDownstep ? 'pitch-accent-downstep' : 'pitch-accent-segment'}
          />
        );
      })}
      {points.map((point, index) => (
        <g key={`mora-${point.x}`}>
          <circle cx={point.x} cy={point.y} r="4" fill="currentColor" />
          <text
            x={point.x}
            y={LABEL_Y}
            textAnchor="middle"
            className="fill-current text-[13px] font-semibold"
          >
            {pitchAccent.morae[index]}
          </text>
        </g>
      ))}
    </svg>
  );
};

export default PitchAccentDiagram;
