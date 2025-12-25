import { Loader } from 'lucide-react';

export type SpeedValue =
  | '0.7x'
  | '0.85x'
  | '1.0x'
  | 'slow'
  | 'medium'
  | 'normal'
  | 0.7
  | 0.85
  | 1.0;

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
  variant?: 'keylime' | 'coral' | 'strawberry' | 'periwinkle';
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

const SpeedSelector = ({
  selectedSpeed,
  onSpeedChange,
  disabled = false,
  loading = false,
  loadingSpeed,
  showLabels = true,
  variant = 'keylime',
  className = '',
}: SpeedSelectorProps) => {
  const normalizedSelected = normalizeSpeed(selectedSpeed);
  const normalizedLoading = loadingSpeed ? normalizeSpeed(loadingSpeed) : null;

  // Bold colors for each speed option
  const getSpeedClasses = (option: SpeedOption, isSelected: boolean) => {
    if (isSelected) {
      if (option.value === '0.7x') return 'bg-strawberry text-white shadow-md';
      if (option.value === '0.85x') return 'bg-yellow text-navy shadow-md';
      return 'bg-keylime text-white shadow-md';
    }
    return 'text-navy hover:bg-white/50';
  };

  return (
    <div className={`flex items-center gap-1 bg-white rounded-lg p-1 shadow-sm ${className}`}>
      {SPEED_OPTIONS.map((option) => {
        const isSelected = normalizedSelected === option.value;
        const isLoading = loading && normalizedLoading === option.value;
        const buttonLabel = showLabels ? `${option.label} (${option.value})` : option.value;

        return (
          <button
            type="button"
            key={option.value}
            onClick={() => onSpeedChange(option.value as SpeedValue)}
            disabled={disabled}
            className={`px-4 py-1.5 rounded text-sm font-bold transition-colors flex items-center gap-1 ${getSpeedClasses(
              option,
              isSelected
            )} ${disabled ? 'disabled:opacity-50' : ''}`}
            data-testid={`playback-speed-${option.label.toLowerCase()}`}
          >
            {isLoading && <Loader className="w-3 h-3 animate-spin" />}
            {buttonLabel}
          </button>
        );
      })}
    </div>
  );
};

export default SpeedSelector;
