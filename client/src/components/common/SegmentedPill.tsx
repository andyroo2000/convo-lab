import { ColorScheme } from './Pill';

interface SegmentProps {
  text: string;
  colorScheme?: ColorScheme;
}

interface SegmentedPillProps {
  leftSegment: SegmentProps;
  rightSegment: SegmentProps;
  uppercase?: boolean;
  capitalize?: boolean;
  className?: string;
}

const SEGMENT_COLORS: Record<ColorScheme, string> = {
  'indigo': 'bg-indigo-600 text-white',
  'purple': 'bg-purple-600 text-white',
  'emerald': 'bg-emerald-600 text-white',
  'blue': 'bg-blue-600 text-white',
  'yellow': 'bg-yellow-600 text-white',
  'red': 'bg-red-600 text-white',
  'green': 'bg-green-600 text-white',
  'gray': 'bg-gray-600 text-white',
  'orange': 'bg-orange-600 text-white',
  'pale-sky': 'bg-pale-sky text-navy',
};

export default function SegmentedPill({
  leftSegment,
  rightSegment,
  uppercase = false,
  capitalize = false,
  className = '',
}: SegmentedPillProps) {
  const leftColors = SEGMENT_COLORS[leftSegment.colorScheme || 'indigo'];
  const rightColors = SEGMENT_COLORS[rightSegment.colorScheme || 'purple'];

  const leftTextTransform = uppercase ? 'uppercase tracking-wide' : capitalize ? 'capitalize' : '';
  const rightTextTransform = capitalize ? 'capitalize' : uppercase ? 'uppercase tracking-wide' : '';

  return (
    <div className={`inline-flex items-center text-sm font-medium overflow-hidden rounded-md shadow-sm ${className}`}>
      {/* Left segment */}
      <div className={`pl-4 pr-5 py-1.5 ${leftColors} ${leftTextTransform}`}>
        {leftSegment.text}
      </div>

      {/* Right segment with chevron */}
      <div
        className={`pl-3 pr-4 py-1.5 ${rightColors} ${rightTextTransform} relative`}
        style={{
          clipPath: 'polygon(8px 0%, 100% 0%, 100% 100%, 8px 100%, 0% 50%)',
          marginLeft: '-8px'
        }}
      >
        <span className="ml-2">{rightSegment.text}</span>
      </div>
    </div>
  );
}
