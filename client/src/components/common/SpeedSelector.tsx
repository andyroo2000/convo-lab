import { Loader } from 'lucide-react';

export type SpeedValue = '0.7x' | '0.85x' | '1.0x' | 'slow' | 'medium' | 'normal' | 0.7 | 0.85 | 1.0;

interface SpeedOption {
  value: SpeedValue;
  label: string;
  numericValue: number;
}

interface SpeedSelectorProps {
  selectedSpeed: SpeedValue;
  onSpeedChange: (speed: SpeedValue) => void;
  disabled?: boolean;
  loading?: boolean;
  loadingSpeed?: SpeedValue;
  showLabels?: boolean; // If true, shows "Slow (0.7x)", otherwise just "0.7x"
  variant?: 'purple' | 'emerald';
  className?: string;
}

const SPEED_OPTIONS: SpeedOption[] = [
  { value: '0.7x', label: 'Slow', numericValue: 0.7 },
  { value: '0.85x', label: 'Medium', numericValue: 0.85 },
  { value: '1.0x', label: 'Normal', numericValue: 1.0 },
];

// Normalize different speed formats to our standard format
function normalizeSpeed(speed: SpeedValue): string {
  if (speed === 'slow' || speed === 0.7) return '0.7x';
  if (speed === 'medium' || speed === 0.85) return '0.85x';
  if (speed === 'normal' || speed === 1.0) return '1.0x';
  return speed;
}

export default function SpeedSelector({
  selectedSpeed,
  onSpeedChange,
  disabled = false,
  loading = false,
  loadingSpeed,
  showLabels = true,
  variant = 'purple',
  className = '',
}: SpeedSelectorProps) {
  const normalizedSelected = normalizeSpeed(selectedSpeed);
  const normalizedLoading = loadingSpeed ? normalizeSpeed(loadingSpeed) : null;

  // Determine active/inactive colors based on variant
  const activeClasses = variant === 'emerald'
    ? 'bg-emerald-600 text-white'
    : 'bg-purple-600 text-white shadow-sm';

  const inactiveClasses = 'text-gray-700 hover:bg-gray-200';

  return (
    <div className={`flex items-center gap-2 bg-gray-100 rounded-lg p-1 ${className}`}>
      {SPEED_OPTIONS.map((option) => {
        const isSelected = normalizedSelected === option.value;
        const isLoading = loading && normalizedLoading === option.value;
        const buttonLabel = showLabels
          ? `${option.label} (${option.value})`
          : option.value;

        return (
          <button
            key={option.value}
            onClick={() => onSpeedChange(option.value as SpeedValue)}
            disabled={disabled}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1 ${
              isSelected ? activeClasses : inactiveClasses
            } ${disabled ? 'disabled:opacity-50' : ''}`}
          >
            {isLoading && <Loader className="w-3 h-3 animate-spin" />}
            {buttonLabel}
          </button>
        );
      })}
    </div>
  );
}
