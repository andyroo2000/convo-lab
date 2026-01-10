import { ReactNode } from 'react';

export type ColorScheme =
  | 'periwinkle'
  | 'coral'
  | 'strawberry'
  | 'keylime'
  | 'mint'
  | 'olive'
  | 'blue'
  | 'yellow'
  | 'red'
  | 'green'
  | 'gray'
  | 'orange'
  | 'pale-sky';

export type Intensity = 'light' | 'solid';

interface PillProps {
  children: ReactNode;
  color?: ColorScheme;
  intensity?: Intensity;
  variant?: 'default' | 'rounded-full' | 'small';
  animated?: boolean;
  uppercase?: boolean;
  capitalize?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  className?: string;
}

const COLOR_SCHEMES: Record<ColorScheme, Record<Intensity, { bg: string; text: string }>> = {
  periwinkle: {
    light: { bg: 'bg-periwinkle-light', text: 'text-periwinkle-dark' },
    solid: { bg: 'bg-periwinkle', text: 'text-white' },
  },
  coral: {
    light: { bg: 'bg-coral-light', text: 'text-coral-dark' },
    solid: { bg: 'bg-coral', text: 'text-white' },
  },
  strawberry: {
    light: { bg: 'bg-strawberry-light', text: 'text-strawberry-dark' },
    solid: { bg: 'bg-strawberry', text: 'text-white' },
  },
  keylime: {
    light: { bg: 'bg-keylime-light', text: 'text-keylime-dark' },
    solid: { bg: 'bg-keylime', text: 'text-dark-brown' },
  },
  mint: {
    light: { bg: 'bg-mint', text: 'text-mint-dark' },
    solid: { bg: 'bg-mint-dark', text: 'text-white' },
  },
  olive: {
    light: { bg: 'bg-olive-light', text: 'text-olive-dark' },
    solid: { bg: 'bg-olive', text: 'text-white' },
  },
  blue: {
    light: { bg: 'bg-blue-100', text: 'text-blue-800' },
    solid: { bg: 'bg-blue-600', text: 'text-white' },
  },
  yellow: {
    light: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
    solid: { bg: 'bg-yellow-600', text: 'text-white' },
  },
  red: {
    light: { bg: 'bg-red-100', text: 'text-red-700' },
    solid: { bg: 'bg-red-600', text: 'text-white' },
  },
  green: {
    light: { bg: 'bg-green-100', text: 'text-green-800' },
    solid: { bg: 'bg-green-600', text: 'text-white' },
  },
  gray: {
    light: { bg: 'bg-gray-100', text: 'text-gray-600' },
    solid: { bg: 'bg-gray-600', text: 'text-white' },
  },
  orange: {
    light: { bg: 'bg-orange-100', text: 'text-orange-800' },
    solid: { bg: 'bg-orange-600', text: 'text-white' },
  },
  'pale-sky': {
    light: { bg: 'bg-pale-sky', text: 'text-dark-brown' },
    solid: { bg: 'bg-pale-sky', text: 'text-dark-brown' },
  },
};

const Pill = ({
  children,
  color = 'gray',
  intensity = 'light',
  variant = 'default',
  animated = false,
  uppercase = false,
  capitalize = false,
  icon,
  iconPosition = 'left',
  className = '',
}: PillProps) => {
  const colors = COLOR_SCHEMES[color][intensity];

  // Base styles
  const baseStyles = 'inline-flex items-center font-medium';

  // Variant-specific styles
  const variantStyles = {
    default: 'px-2 py-1 rounded',
    'rounded-full': 'px-2 py-1 rounded-full',
    small: 'px-2 py-1 rounded text-xs',
  }[variant];

  // Text transform
  let textTransform = '';
  if (uppercase) {
    textTransform = 'uppercase';
  } else if (capitalize) {
    textTransform = 'capitalize';
  }

  // Animation
  const animation = animated ? 'animate-pulse' : '';

  // Icon spacing
  const iconSpacing = icon ? 'gap-1' : '';

  return (
    <span
      className={`${baseStyles} ${variantStyles} ${colors.bg} ${colors.text} ${textTransform} ${animation} ${iconSpacing} ${className}`}
    >
      {icon && iconPosition === 'left' && icon}
      {children}
      {icon && iconPosition === 'right' && icon}
    </span>
  );
};

export default Pill;
