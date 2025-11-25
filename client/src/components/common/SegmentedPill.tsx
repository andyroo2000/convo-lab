import { ColorScheme } from './Pill';

interface SegmentedPillProps {
  leftText: string;
  rightText: string;
  leftColor?: ColorScheme;
  rightColor?: ColorScheme;
  uppercase?: boolean;
  capitalize?: boolean;
  className?: string;
}

const SEGMENT_COLORS: Record<ColorScheme, string> = {
  'periwinkle': 'bg-periwinkle text-white',
  'coral': 'bg-coral text-white',
  'strawberry': 'bg-strawberry text-white',
  'keylime': 'bg-keylime text-white',
  'mint': 'bg-mint-dark text-white',
  'olive': 'bg-olive text-white',
  'blue': 'bg-periwinkle text-white',
  'yellow': 'bg-yellow text-navy',
  'red': 'bg-red-600 text-white',
  'green': 'bg-green-600 text-white',
  'gray': 'bg-gray-600 text-white',
  'orange': 'bg-coral text-white',
  'pale-sky': 'bg-periwinkle text-white',
};

export default function SegmentedPill({
  leftText,
  rightText,
  leftColor = 'indigo',
  rightColor = 'purple',
  uppercase = false,
  capitalize = false,
  className = '',
}: SegmentedPillProps) {
  const leftColors = SEGMENT_COLORS[leftColor];
  const rightColors = SEGMENT_COLORS[rightColor];

  const leftTextTransform = uppercase ? 'uppercase tracking-wide' : capitalize ? 'capitalize' : '';
  const rightTextTransform = capitalize ? 'capitalize' : uppercase ? 'uppercase tracking-wide' : '';

  return (
    <div className={`inline-flex items-center text-sm font-medium overflow-hidden rounded-md shadow-sm ${className}`}>
      {/* Left segment */}
      <div className={`pl-4 pr-5 py-1.5 ${leftColors} ${leftTextTransform}`}>
        {leftText}
      </div>

      {/* Right segment with chevron */}
      <div
        className={`pl-3 pr-4 py-1.5 ${rightColors} ${rightTextTransform} relative`}
        style={{
          clipPath: 'polygon(8px 0%, 100% 0%, 100% 100%, 8px 100%, 0% 50%)',
          marginLeft: '-8px'
        }}
      >
        <span className="ml-2">{rightText}</span>
      </div>
    </div>
  );
}
