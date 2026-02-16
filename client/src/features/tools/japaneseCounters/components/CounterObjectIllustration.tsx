import type { CounterIllustrationId } from '../logic/counterPractice';

interface CounterObjectIllustrationProps {
  illustrationId: CounterIllustrationId;
  className?: string;
}

const STROKE_PROPS = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const CounterObjectIllustration = ({
  illustrationId,
  className,
}: CounterObjectIllustrationProps) => {
  switch (illustrationId) {
    case 'paper-sheet':
      return (
        <svg className={className} viewBox="0 0 140 110" aria-label="sheet of paper" role="img">
          <rect x="26" y="12" width="88" height="84" rx="4" {...STROKE_PROPS} />
          <line x1="37" y1="34" x2="103" y2="34" {...STROKE_PROPS} />
          <line x1="37" y1="50" x2="103" y2="50" {...STROKE_PROPS} />
          <line x1="37" y1="66" x2="85" y2="66" {...STROKE_PROPS} />
        </svg>
      );

    case 'postcard':
      return (
        <svg className={className} viewBox="0 0 140 110" aria-label="postcard" role="img">
          <rect x="20" y="20" width="100" height="68" rx="5" {...STROKE_PROPS} />
          <line x1="20" y1="54" x2="120" y2="54" {...STROKE_PROPS} />
          <line x1="78" y1="33" x2="109" y2="33" {...STROKE_PROPS} />
          <line x1="78" y1="43" x2="109" y2="43" {...STROKE_PROPS} />
        </svg>
      );

    case 'tshirt':
      return (
        <svg className={className} viewBox="0 0 140 110" aria-label="t-shirt" role="img">
          <path d="M44 27l15-10h22l15 10 14 8-12 20-10-6v44H52V49l-10 6-12-20z" {...STROKE_PROPS} />
          <path d="M60 18c0 6 4 11 10 11s10-5 10-11" {...STROKE_PROPS} />
        </svg>
      );

    case 'pencil':
      return (
        <svg className={className} viewBox="0 0 140 110" aria-label="pencil" role="img">
          <path d="M22 78l69-69 20 20-69 69-24 4z" {...STROKE_PROPS} />
          <line x1="79" y1="21" x2="99" y2="41" {...STROKE_PROPS} />
          <line x1="42" y1="98" x2="34" y2="90" {...STROKE_PROPS} />
        </svg>
      );

    case 'umbrella':
      return (
        <svg className={className} viewBox="0 0 140 110" aria-label="umbrella" role="img">
          <path d="M20 56c12-20 34-32 50-32s38 12 50 32H20z" {...STROKE_PROPS} />
          <line x1="70" y1="24" x2="70" y2="76" {...STROKE_PROPS} />
          <path d="M70 76c0 9 5 14 12 14 6 0 10-4 10-9" {...STROKE_PROPS} />
        </svg>
      );

    case 'banana':
      return (
        <svg className={className} viewBox="0 0 140 110" aria-label="banana" role="img">
          <path d="M24 72c20 20 58 22 88-11" {...STROKE_PROPS} />
          <path d="M30 58c19 17 48 17 73-6" {...STROKE_PROPS} />
          <line x1="24" y1="72" x2="20" y2="64" {...STROKE_PROPS} />
          <line x1="112" y1="61" x2="118" y2="58" {...STROKE_PROPS} />
        </svg>
      );

    case 'cat':
      return (
        <svg className={className} viewBox="0 0 140 110" aria-label="cat" role="img">
          <circle cx="70" cy="58" r="28" {...STROKE_PROPS} />
          <path d="M50 39l-8-14 18 7" {...STROKE_PROPS} />
          <path d="M90 39l8-14-18 7" {...STROKE_PROPS} />
          <circle cx="60" cy="58" r="2.8" fill="currentColor" />
          <circle cx="80" cy="58" r="2.8" fill="currentColor" />
          <path d="M64 70c4 4 8 4 12 0" {...STROKE_PROPS} />
        </svg>
      );

    case 'dog':
      return (
        <svg className={className} viewBox="0 0 140 110" aria-label="dog" role="img">
          <circle cx="70" cy="56" r="27" {...STROKE_PROPS} />
          <path d="M47 46l-12-13 5 21" {...STROKE_PROPS} />
          <path d="M93 46l12-13-5 21" {...STROKE_PROPS} />
          <circle cx="61" cy="57" r="2.5" fill="currentColor" />
          <circle cx="79" cy="57" r="2.5" fill="currentColor" />
          <ellipse cx="70" cy="66" rx="5" ry="4" {...STROKE_PROPS} />
        </svg>
      );

    case 'fish':
      return (
        <svg className={className} viewBox="0 0 140 110" aria-label="fish" role="img">
          <path
            d="M24 56c13-16 28-24 48-24 22 0 38 10 52 24-14 14-30 24-52 24-20 0-35-8-48-24z"
            {...STROKE_PROPS}
          />
          <path d="M24 56L10 44v24z" {...STROKE_PROPS} />
          <circle cx="83" cy="54" r="3" fill="currentColor" />
          <line x1="100" y1="56" x2="116" y2="56" {...STROKE_PROPS} />
        </svg>
      );

    default:
      return null;
  }
};

export default CounterObjectIllustration;
